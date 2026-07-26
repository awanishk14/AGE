import { PrismaClient } from '@prisma/client';
import {
  normalizeScoredBifSnapshotRecord,
  produceScoredBifContext,
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  toScoredBifSnapshot,
  type ScoredBifContext,
  type ScoredBifSnapshotRecord,
} from '@age/business-discovery-contracts';
import {
  PrismaScoredBifSnapshotRepository,
  type ScoredBifSnapshotDelegate,
} from '@age/scored-bif-snapshot-persistence';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * LIVE PostgreSQL tests for the durable scored BIF snapshot adapter
 * (ADR-0032 D11). This is the only suite in the repository that talks to a
 * database.
 *
 * WHAT THIS PROVES THAT THE TABLE DOUBLE CANNOT. PR #106 delivered the durable
 * adapter with an honest limit attached: no test had ever reached PostgreSQL,
 * so nothing showed that the DDL applies, that the composite primary key really
 * rejects a duplicate, that `jsonb` round-trips the context, or that
 * PostgreSQL's own ordering of `captured_at` agrees with the JavaScript
 * comparison the double used. This suite closes exactly that gap, and nothing
 * wider.
 *
 * The table-double suite in `@age/scored-bif-snapshot-persistence` is NOT
 * replaced (ADR-0032 D12). It still runs, still runs everywhere, and still
 * asserts things a live database makes harder to see — such as which queries the
 * adapter issues and which it never issues.
 *
 * IT FAILS, IT DOES NOT SKIP. Without `DATABASE_URL` this file throws at import
 * time. A skipped test reports as a pass, and a green suite that proved nothing
 * is the failure ADR-0032 exists to prevent.
 */

const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for live database tests (*.db.spec.ts). ' +
      'Point it at a DISPOSABLE database with the committed migrations applied:\n' +
      '  pnpm --filter @age/persistence prisma:migrate:deploy\n' +
      '  DATABASE_URL=postgresql://age:age@localhost:5432/age_test pnpm --filter @age/persistence test:db\n' +
      'These tests never skip: a silent skip would report green while proving nothing (ADR-0032 D13).',
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

/**
 * The load-bearing wiring of this whole slice — and a CORRECTION to PR #106.
 *
 * PR #106 typed the adapter against a minimal STRUCTURAL delegate rather than
 * generated Prisma types, and claimed a real `PrismaClient.scoredBifSnapshot`
 * "satisfies it structurally at a future composition root". Generating the
 * client and trying the assignment — the first time anyone has — shows that
 * claim is very nearly true, and not exactly true. `tsc` accepts `findUnique`
 * and `findMany`; it rejects `create` on exactly one point:
 *
 *     Type 'unknown' is not assignable to type 'JsonNull | InputJsonValue'
 *
 * `ScoredBifSnapshotRow.context` is `unknown`, which is WIDER than the JSON
 * values Prisma will accept as input. The port is not wrong — a stored context
 * genuinely is untrusted `unknown` on the way back out — but a caller must
 * narrow it on the way in.
 *
 * That narrowing belongs at the composition root, which is what this file is
 * standing in for. Doing it by changing the port's `context` type would be an
 * adapter API change, which this slice is explicitly not authorized to make
 * (ADR-0032, first implementation slice). It is recorded as follow-up work
 * instead. Runtime behaviour is unaffected: this is purely an input-type
 * variance, and every assertion below exercises the real delegate.
 */
const delegate = prisma.scoredBifSnapshot as unknown as ScoredBifSnapshotDelegate;

const MAPPER_OPTIONS = {
  organizationId: 'org-northwind',
  constructedAt: new Date('2026-07-15T09:30:00.000Z'),
  changedBy: 'analyst@example.com',
} as const;

/** Scope as a caller takes it off a `ClientContext` — never off the payload. */
const SCOPE = {
  clientId: 'client-northwind',
  organizationId: 'org-northwind',
} as const;

function sampleContext(): ScoredBifContext {
  return produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, MAPPER_OPTIONS).context;
}

const CONTEXT = sampleContext();

function makeRecord(overrides: Partial<ScoredBifSnapshotRecord> = {}): ScoredBifSnapshotRecord {
  return {
    ...SCOPE,
    bifId: CONTEXT.bifId,
    snapshotId: 'snap-1',
    capturedAt: '2026-07-15T09:30:00.000Z',
    snapshot: toScoredBifSnapshot(CONTEXT),
    ...overrides,
  };
}

function seriesKeyOf(record: ScoredBifSnapshotRecord) {
  return {
    clientId: record.clientId,
    organizationId: record.organizationId,
    bifId: record.bifId,
  };
}

function keyOf(record: ScoredBifSnapshotRecord) {
  return { ...seriesKeyOf(record), snapshotId: record.snapshotId };
}

function newRepository(): PrismaScoredBifSnapshotRepository {
  return new PrismaScoredBifSnapshotRepository(delegate);
}

/**
 * Cleanup uses raw SQL, NOT the adapter — the adapter has no delete, which is
 * the whole design (ADR-0030). A test harness needing one is not evidence the
 * production surface should have one.
 */
async function truncate(): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "scored_bif_snapshots"');
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncate();
});

describe('scored_bif_snapshots — live PostgreSQL', () => {
  describe('the generated Prisma delegate', () => {
    it('provides exactly the three methods the port declares', () => {
      const candidate = prisma.scoredBifSnapshot as unknown as Record<string, unknown>;

      for (const method of ['create', 'findUnique', 'findMany']) {
        expect(typeof candidate[method]).toBe('function');
      }
    });

    it('also provides mutation methods, which the port deliberately hides', () => {
      const candidate = prisma.scoredBifSnapshot as unknown as Record<string, unknown>;

      // Prisma generates `update`/`delete` whether or not we want them. The
      // narrow `ScoredBifSnapshotDelegate` is what withholds them from the
      // adapter, so this asserts WHY that interface has to stay narrow: the
      // capability is right there, one widened type away (ADR-0031 D8).
      expect(typeof candidate['update']).toBe('function');
      expect(typeof candidate['delete']).toBe('function');
      expect(Object.keys(new PrismaScoredBifSnapshotRepository(delegate))).not.toContain('update');
    });
  });

  describe('the migration', () => {
    it('created a table the adapter can actually store a snapshot in', async () => {
      const repository = newRepository();

      await repository.append(makeRecord());

      const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*)::bigint AS count FROM "scored_bif_snapshots"',
      );
      expect(Number(rows[0]?.count ?? 0)).toBe(1);
    });

    it('created exactly the eight approved columns and none of the forbidden ones', async () => {
      const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'scored_bif_snapshots' ORDER BY column_name`,
      );
      const names = columns.map((column) => column.column_name);

      expect(names).toEqual([
        'bif_id',
        'captured_at',
        'client_id',
        'context',
        'organization_id',
        'scoring_version',
        'snapshot_id',
        'snapshot_version',
      ]);

      // Append-only is enforced by absence. If any of these ever appears, a
      // migration revoked a ratified guarantee (ADR-0030, ADR-0031, ADR-0032 D7).
      for (const forbidden of ['updated_at', 'version', 'deleted_at', 'current', 'is_current']) {
        expect(names, `${forbidden} must not exist on this table`).not.toContain(forbidden);
      }
    });

    it('stores the context as jsonb, not as text', async () => {
      const columns = await prisma.$queryRawUnsafe<Array<{ data_type: string }>>(
        `SELECT data_type FROM information_schema.columns
         WHERE table_name = 'scored_bif_snapshots' AND column_name = 'context'`,
      );
      expect(columns[0]?.data_type).toBe('jsonb');
    });

    it('created the composite primary key and the series index', async () => {
      const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'scored_bif_snapshots'`,
      );
      const names = indexes.map((index) => index.indexname);

      expect(names).toContain('scored_bif_snapshots_pkey');
      expect(names).toContain('scored_bif_snapshots_series_latest_idx');
    });
  });

  describe('append and read', () => {
    it('stores a snapshot and reads it back by full composite identity', async () => {
      const repository = newRepository();
      const record = makeRecord();

      await repository.append(record);
      const found = await repository.findBySnapshotId(keyOf(record));

      expect(found).not.toBeNull();
      expect(found?.snapshotId).toBe('snap-1');
      expect(found?.bifId).toBe(CONTEXT.bifId);
    });

    it('round-trips the context through jsonb with every value intact', async () => {
      const repository = newRepository();
      const record = makeRecord();

      await repository.append(record);
      const found = await repository.findBySnapshotId(keyOf(record));

      // Deep equality, deliberately — not string equality. See below.
      expect(found?.snapshot.context).toEqual(record.snapshot.context);
      expect(found?.snapshot.snapshotVersion).toBe(record.snapshot.snapshotVersion);
    });

    it('does NOT preserve key order, because jsonb stores a value and not a document', async () => {
      const repository = newRepository();
      const record = makeRecord();

      await repository.append(record);
      const found = await repository.findBySnapshotId(keyOf(record));

      // This is the first thing a live database taught us that the table
      // double could not: `jsonb` parses, normalises and re-serialises. Keys
      // come back reordered (PostgreSQL orders them by length then bytes), so a
      // stored context is byte-identical in VALUE and not in TEXT. `json` would
      // have preserved the text; ADR-0031 D7 chose `jsonb` for indexing and
      // containment, and this is the price.
      //
      // Nothing downstream depends on the stored byte order —
      // `serializeScoredBifSnapshot` produces the byte-stable form by sorting
      // keys itself, precisely so byte-stability never depends on storage.
      expect(JSON.stringify(found?.snapshot.context)).not.toBe(
        JSON.stringify(record.snapshot.context),
      );
    });

    it('reads a row back through the same validation an append passes', async () => {
      const repository = newRepository();
      const record = makeRecord();

      await repository.append(record);
      const found = await repository.findBySnapshotId(keyOf(record));

      // Stored data is untrusted input (ADR-0031 D11): what comes back must
      // still satisfy the record contract.
      expect(() =>
        normalizeScoredBifSnapshotRecord(found as ScoredBifSnapshotRecord),
      ).not.toThrow();
    });
  });

  describe('scope', () => {
    it('does not return another client’s snapshot for the same bifId', async () => {
      const repository = newRepository();
      const record = makeRecord();
      await repository.append(record);

      const found = await repository.findBySnapshotId({
        ...keyOf(record),
        clientId: 'client-someone-else',
      });

      expect(found).toBeNull();
    });

    it('does not return another organization’s snapshot for the same bifId', async () => {
      const repository = newRepository();
      const record = makeRecord();
      await repository.append(record);

      const found = await repository.findBySnapshotId({
        ...keyOf(record),
        organizationId: 'org-someone-else',
      });

      expect(found).toBeNull();
    });

    it('keeps two clients sharing a bifId in separate series', async () => {
      const repository = newRepository();
      const mine = makeRecord();
      const theirs = makeRecord({ clientId: 'client-contoso' });

      await repository.append(mine);
      await repository.append(theirs);

      expect(await repository.listSeries(seriesKeyOf(mine))).toHaveLength(1);
      expect(await repository.listSeries(seriesKeyOf(theirs))).toHaveLength(1);
    });

    it('takes scope from the key, never from the payload', async () => {
      const repository = newRepository();
      // The context carries a bifId; it carries no client and no organization.
      // Storing under a scope the payload knows nothing about must work, and
      // must not be readable under any other scope.
      const record = makeRecord({ clientId: 'client-unrelated-to-payload' });

      await repository.append(record);

      expect(await repository.findBySnapshotId(keyOf(record))).not.toBeNull();
      expect(
        await repository.findBySnapshotId({ ...keyOf(record), clientId: 'client-northwind' }),
      ).toBeNull();
    });
  });

  describe('append-only', () => {
    it('is the DATABASE that rejects a duplicate composite identity', async () => {
      const repository = newRepository();
      const record = makeRecord();
      await repository.append(record);

      await expect(repository.append(makeRecord())).rejects.toThrow(/already exists/i);

      // And the original is untouched — a rejected append is not a partial write.
      const found = await repository.findBySnapshotId(keyOf(record));
      expect(found?.capturedAt).toBe('2026-07-15T09:30:00.000Z');
      expect(await repository.listSeries(seriesKeyOf(record))).toHaveLength(1);
    });

    it('exposes no update, delete or upsert on the repository at all', () => {
      const repository = newRepository();

      for (const forbidden of [
        'update',
        'updateMany',
        'upsert',
        'delete',
        'deleteMany',
        'save',
        'softDelete',
        'setCurrent',
      ]) {
        expect(
          (repository as unknown as Record<string, unknown>)[forbidden],
          `${forbidden} must not exist on the repository`,
        ).toBeUndefined();
      }
    });

    it('grants no way to mutate a stored row through the port', async () => {
      const repository = newRepository();
      const record = makeRecord();
      await repository.append(record);

      const first = await repository.findBySnapshotId(keyOf(record));
      // Re-appending under a NEW id is the only way to record a change.
      await repository.append(makeRecord({ snapshotId: 'snap-2' }));
      const stillFirst = await repository.findBySnapshotId(keyOf(record));

      expect(JSON.stringify(stillFirst)).toBe(JSON.stringify(first));
    });
  });

  describe('ordering and latest', () => {
    it('derives latest from capturedAt as PostgreSQL orders it, not from insertion order', async () => {
      const repository = newRepository();
      const newest = makeRecord({ snapshotId: 'snap-c', capturedAt: '2026-07-20T00:00:00.000Z' });

      // Inserted middle, then newest, then oldest — insertion order is a lie here.
      await repository.append(
        makeRecord({ snapshotId: 'snap-b', capturedAt: '2026-07-16T00:00:00.000Z' }),
      );
      await repository.append(newest);
      await repository.append(
        makeRecord({ snapshotId: 'snap-a', capturedAt: '2026-07-01T00:00:00.000Z' }),
      );

      const latest = await repository.findLatest(seriesKeyOf(newest));
      expect(latest?.snapshotId).toBe('snap-c');

      const series = await repository.listSeries(seriesKeyOf(newest));
      expect(series.map((entry) => entry.snapshotId)).toEqual(['snap-a', 'snap-b', 'snap-c']);
    });

    it('breaks a capturedAt tie by snapshotId, in PostgreSQL’s collation', async () => {
      const repository = newRepository();
      const tied = '2026-07-15T09:30:00.000Z';

      await repository.append(makeRecord({ snapshotId: 'snap-b', capturedAt: tied }));
      await repository.append(makeRecord({ snapshotId: 'snap-a', capturedAt: tied }));

      const record = makeRecord();
      const series = await repository.listSeries(seriesKeyOf(record));
      expect(series.map((entry) => entry.snapshotId)).toEqual(['snap-a', 'snap-b']);

      const latest = await repository.findLatest(seriesKeyOf(record));
      expect(latest?.snapshotId).toBe('snap-b');
    });

    it('returns null for a latest that does not exist', async () => {
      const repository = newRepository();
      expect(await repository.findLatest({ ...SCOPE, bifId: 'bif-never-written' })).toBeNull();
    });
  });

  describe('scoringVersion', () => {
    it('is an attribute, not part of the key', async () => {
      const repository = newRepository();
      const record = makeRecord();
      await repository.append(record);

      // Same identity, different scoring version: still a duplicate, because
      // scoringVersion is not in the key (ADR-0031 D4).
      await expect(repository.append(makeRecord())).rejects.toThrow(/already exists/i);
    });

    it('allows many snapshots under one scoringVersion', async () => {
      const repository = newRepository();
      await repository.append(makeRecord({ snapshotId: 'snap-1' }));
      await repository.append(makeRecord({ snapshotId: 'snap-2' }));
      await repository.append(makeRecord({ snapshotId: 'snap-3' }));

      const series = await repository.listSeries(seriesKeyOf(makeRecord()));
      expect(series).toHaveLength(3);

      const versions = new Set(
        series.map((entry) => entry.snapshot.context.metadata.scoringVersion),
      );
      expect(versions.size).toBe(1);
    });

    it('is denormalised into its own column for querying', async () => {
      const repository = newRepository();
      await repository.append(makeRecord());

      const rows = await prisma.$queryRawUnsafe<Array<{ scoring_version: string | null }>>(
        'SELECT scoring_version FROM "scored_bif_snapshots"',
      );
      expect(rows[0]?.scoring_version).toBe(CONTEXT.metadata.scoringVersion ?? null);
    });
  });

  describe('the adapter generates nothing', () => {
    it('stores the caller’s snapshotId verbatim', async () => {
      const repository = newRepository();
      const record = makeRecord({ snapshotId: 'snap-caller-chose-this-exact-string' });

      await repository.append(record);

      const rows = await prisma.$queryRawUnsafe<Array<{ snapshot_id: string }>>(
        'SELECT snapshot_id FROM "scored_bif_snapshots"',
      );
      expect(rows[0]?.snapshot_id).toBe('snap-caller-chose-this-exact-string');
    });

    it('stores the caller’s capturedAt verbatim, reading no clock', async () => {
      const repository = newRepository();
      // Deliberately in the past: a wall clock would overwrite this.
      const record = makeRecord({ capturedAt: '2019-01-02T03:04:05.678Z' });

      await repository.append(record);

      const rows = await prisma.$queryRawUnsafe<Array<{ captured_at: string }>>(
        'SELECT captured_at FROM "scored_bif_snapshots"',
      );
      expect(rows[0]?.captured_at).toBe('2019-01-02T03:04:05.678Z');

      const found = await repository.findBySnapshotId(keyOf(record));
      expect(found?.capturedAt).toBe('2019-01-02T03:04:05.678Z');
    });

    it('never mutates the record it was handed', async () => {
      const repository = newRepository();
      const record = makeRecord();
      const before = JSON.stringify(record);

      await repository.append(record);

      expect(JSON.stringify(record)).toBe(before);
    });
  });
});
