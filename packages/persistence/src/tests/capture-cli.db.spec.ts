import { PrismaClient } from '@prisma/client';
import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '@age/business-discovery-contracts';
import { CAPTURE_EXIT_CODES, runCapture, type CaptureRuntime } from '@age/capture';
import { openPrismaCaptureConnection } from '@age/capture/composition';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * LIVE PostgreSQL test for the capture CLI's composition root (ADR-0043 D6/D8,
 * Slice B2).
 *
 * WHY IT LIVES IN `@age/persistence` AND NOT IN `apps/capture`. The live run is
 * `vitest run --config vitest.db.config.ts` from THIS package, and that config
 * includes `src/**\/*.db.spec.ts` relative to this package only. A spec of this
 * name under `apps/capture` would be collected by nothing at all, and its
 * absence would read as a pass — the exact failure mode ADR-0032 exists to
 * prevent.
 *
 * WHAT IT PROVES THAT NO UNIT TEST CAN. `capture-runner.spec.ts` drives the run
 * against a fake orchestrator, so it proves the decisions and nothing about the
 * chain. Here the run goes through the real
 * `PrismaClient → PrismaScoredBifSnapshotScopeRunner →
 * ScopedScoredBifSnapshotRepository → ScoredBifSnapshotCaptureOrchestrator`
 * assembled by the production composition root, against real PostgreSQL, as the
 * NON-OWNER `age_app` role under `FORCE ROW LEVEL SECURITY` (D8). If the runner
 * ever stopped setting the transaction-local GUCs, `NULLIF(current_setting(…),
 * '')` would be NULL, NULL is not TRUE, and every INSERT would be refused. That
 * is the single thing the draft ADR-0043 D6 chain got wrong, and this is where
 * it would be caught.
 *
 * IT FAILS, IT DOES NOT SKIP.
 */

const DATABASE_URL = process.env['DATABASE_URL'];
const DATABASE_URL_APP = process.env['DATABASE_URL_APP'];

if (!DATABASE_URL || !DATABASE_URL_APP) {
  throw new Error(
    'DATABASE_URL (owner) and DATABASE_URL_APP (non-owner application role) are both required ' +
      'for the live capture CLI test. It never skips: a suite that silently passes proves nothing.',
  );
}

/** Owner. Cleanup and verification only — never the subject of an assertion. */
const owner = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const INSTANT = new Date('2026-07-30T11:22:33.444Z');

const ARGS = [
  '--profile',
  'sample-profile.json',
  '--client-id',
  'client-a',
  '--organization-id',
  'org-alpha',
  '--changed-by',
  'analyst@example.com',
  '--bif-id',
  'bif-capture-cli',
] as const;

/**
 * The real composition root, pointed at the non-owner role.
 *
 * `readProfileText` is still injected: the filesystem is `main.ts`'s business
 * and reading a real file here would prove nothing about the database. What is
 * NOT faked is the only thing this suite is for — the chain.
 */
const runtimeFor = (): CaptureRuntime => ({
  readProfileText: () => JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE),
  now: () => INSTANT,
  newSnapshotId: () => 'snap-minted',
  openCaptureOrchestrator: async () =>
    openPrismaCaptureConnection({ datasourceUrl: DATABASE_URL_APP }),
});

interface StoredRow {
  readonly client_id: string;
  readonly organization_id: string;
  readonly bif_id: string;
  readonly snapshot_id: string;
  readonly captured_at: string;
}

async function rowsAsOwner(): Promise<StoredRow[]> {
  return owner.$queryRaw<StoredRow[]>`
    SELECT client_id, organization_id, bif_id, snapshot_id, captured_at
    FROM "scored_bif_snapshots"`;
}

beforeAll(async () => {
  await owner.$connect();
});

afterAll(async () => {
  await owner.$disconnect();
});

beforeEach(async () => {
  await owner.$executeRawUnsafe('TRUNCATE TABLE "scored_bif_snapshots"');
});

describe('the capture CLI, wired to real PostgreSQL as the application role', () => {
  it('produces without touching the database at all when capture is not requested', async () => {
    const result = await runCapture([...ARGS], runtimeFor());

    expect(result.exitCode).toBe(CAPTURE_EXIT_CODES.ok);
    expect(await rowsAsOwner()).toEqual([]);
  });

  it('writes exactly one correctly-scoped row through the production chain', async () => {
    const result = await runCapture([...ARGS, '--capture', '--confirm'], runtimeFor());

    expect(result.stderr).toEqual([]);
    expect(result.exitCode).toBe(CAPTURE_EXIT_CODES.ok);

    const rows = await rowsAsOwner();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      client_id: 'client-a',
      organization_id: 'org-alpha',
      bif_id: 'bif-capture-cli',
      snapshot_id: 'snap-minted',
      captured_at: '2026-07-30T11:22:33.444Z',
    });
  });

  it('honours an operator-pinned snapshot id and instant', async () => {
    await runCapture(
      [
        ...ARGS,
        '--capture',
        '--confirm',
        '--snapshot-id',
        'snap-pinned',
        '--captured-at',
        '2026-01-02T03:04:05.006Z',
      ],
      runtimeFor(),
    );

    const rows = await rowsAsOwner();
    expect(rows[0]?.snapshot_id).toBe('snap-pinned');
    expect(rows[0]?.captured_at).toBe('2026-01-02T03:04:05.006Z');
  });

  it('refuses a second write under the same identity, and reports it rather than overwriting', async () => {
    const first = await runCapture([...ARGS, '--capture', '--confirm'], runtimeFor());
    expect(first.exitCode).toBe(CAPTURE_EXIT_CODES.ok);

    // The primary key IS the logical identity (ADR-0030). The table is
    // append-only and holds no UPDATE grant, so the only correct outcome is a
    // refusal — never a silent replacement of the first snapshot.
    const second = await runCapture([...ARGS, '--capture', '--confirm'], runtimeFor());

    expect(second.exitCode).toBe(CAPTURE_EXIT_CODES.captureFailed);
    expect(second.stderr[0]).toContain('Capture failed:');
    expect(await rowsAsOwner()).toHaveLength(1);
  });

  it('keeps two different clients in separate series', async () => {
    await runCapture([...ARGS, '--capture', '--confirm'], runtimeFor());
    await runCapture(
      [
        '--profile',
        'sample-profile.json',
        '--client-id',
        'client-b',
        '--organization-id',
        'org-alpha',
        '--changed-by',
        'analyst@example.com',
        '--bif-id',
        'bif-capture-cli',
        '--capture',
        '--confirm',
      ],
      runtimeFor(),
    );

    const rows = await rowsAsOwner();
    expect(rows.map((row) => row.client_id).sort()).toEqual(['client-a', 'client-b']);
  });
});
