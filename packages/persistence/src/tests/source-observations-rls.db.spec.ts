import { PrismaClient } from '@prisma/client';
import { normalizeStoredObservation } from '@age/source-observation';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * LIVE PostgreSQL tests for `source_observations` (ADR-0069 §6, deliverable 2).
 *
 * EVERY ASSERTION RUNS AS THE NON-OWNER ROLE, for the reason the snapshot and
 * session suites give at length: PostgreSQL exempts a superuser from RLS
 * unconditionally and the owner unless the table is FORCEd, so a policy tested
 * on the owner connection would report green even if it had been dropped. The
 * owner is used for exactly two things the app role cannot and must not do —
 * counting rows the app role cannot see, and cleaning up between tests.
 *
 * 🛑 WHAT THIS PROVES AND WHAT IT DOES NOT. It proves the application role can
 * read and append only within its own organization's scope, and cannot edit or
 * remove an observation at all. It does 🚫 NOT prove isolation as an
 * authorization property — RLS is coherence (ADR-0046 D5), and 🚫 the emptiness
 * of a result set is never the proof: every "cannot see" case below is paired
 * with a row the OWNER can still count, so a table that was simply empty fails.
 *
 * IT FAILS, IT DOES NOT SKIP. Both connection strings are required.
 */

const DATABASE_URL = process.env['DATABASE_URL'];
const DATABASE_URL_APP = process.env['DATABASE_URL_APP'];

if (!DATABASE_URL || !DATABASE_URL_APP) {
  throw new Error(
    'DATABASE_URL (owner) and DATABASE_URL_APP (non-owner application role) are both required. ' +
      'These tests never skip: a suite that silently passes as the owner proves nothing.',
  );
}

const owner = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
const app = new PrismaClient({ datasources: { db: { url: DATABASE_URL_APP } } });

interface PlantedObservation {
  readonly observationId: string;
  readonly organizationId: string;
  readonly sourceSystem: string;
  readonly sourceInstance: string;
  readonly sourceRecordId: string;
  readonly subjectDisposition: string;
  readonly subjectKind: string | null;
  readonly subjectLabel: string;
  readonly claimDirection: string;
  readonly claimMateriality: string;
  readonly claimKind: string;
  readonly observedAt: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly recordedAt: string;
}

/** ⚠️ Obviously fictional (ADR-0053 D3). 🚫 No real client, ever. */
const MINE: PlantedObservation = {
  observationId: 'observation-mine',
  organizationId: 'org-alpha',
  sourceSystem: 'example-seo-system',
  sourceInstance: 'example-seo-system-instance-1',
  sourceRecordId: 'example-record-1',
  subjectDisposition: 'modelled',
  subjectKind: 'service',
  subjectLabel: 'Widget Polishing',
  claimDirection: 'down',
  claimMateriality: 'substantial',
  claimKind: 'raw-observation',
  observedAt: '2026-07-31T00:00:00.000Z',
  windowStart: '2026-07-01T00:00:00.000Z',
  windowEnd: '2026-07-31T00:00:00.000Z',
  recordedAt: '2026-08-13T00:00:00.000Z',
};

const THEIRS: PlantedObservation = {
  ...MINE,
  observationId: 'observation-theirs',
  organizationId: 'org-beta',
};

const COLUMNS = `
  ("observation_id", "organization_id", "source_system", "source_instance", "source_record_id",
   "subject_disposition", "subject_kind", "subject_label",
   "claim_direction", "claim_materiality", "claim_kind",
   "observed_at", "window_start", "window_end", "recorded_at")`;

const SELECTION = `
  SELECT "observation_id" AS "observationId", "organization_id" AS "organizationId",
         "source_system" AS "sourceSystem", "source_instance" AS "sourceInstance",
         "source_record_id" AS "sourceRecordId",
         "subject_disposition" AS "subjectDisposition", "subject_kind" AS "subjectKind",
         "subject_label" AS "subjectLabel",
         "claim_direction" AS "claimDirection", "claim_materiality" AS "claimMateriality",
         "claim_kind" AS "claimKind",
         "observed_at" AS "observedAt", "window_start" AS "windowStart",
         "window_end" AS "windowEnd", "recorded_at" AS "recordedAt"
  FROM "source_observations"`;

const values = (row: PlantedObservation): unknown[] => [
  row.observationId,
  row.organizationId,
  row.sourceSystem,
  row.sourceInstance,
  row.sourceRecordId,
  row.subjectDisposition,
  row.subjectKind,
  row.subjectLabel,
  row.claimDirection,
  row.claimMateriality,
  row.claimKind,
  row.observedAt,
  row.windowStart,
  row.windowEnd,
  row.recordedAt,
];

const PLACEHOLDERS = Array.from({ length: 15 }, (_, index) => `$${index + 1}`).join(', ');

/** Plants a row as the OWNER, bypassing the app role's own policy on purpose. */
async function plant(row: PlantedObservation): Promise<void> {
  await owner.$executeRawUnsafe(
    `INSERT INTO "source_observations" ${COLUMNS} VALUES (${PLACEHOLDERS})`,
    ...values(row),
  );
}

async function countAsOwner(): Promise<number> {
  const rows = await owner.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT COUNT(*)::bigint AS count FROM "source_observations"`;
  return Number(rows[0]?.count ?? 0);
}

/** Reads as the application role, inside a transaction scoped to one organization. */
async function readAs(organizationId: string | undefined): Promise<Array<Record<string, unknown>>> {
  return app.$transaction(async (tx) => {
    if (organizationId !== undefined) {
      await tx.$executeRaw`SELECT set_config('age.organization_id', ${organizationId}, true)`;
    }

    return tx.$queryRawUnsafe<Array<Record<string, unknown>>>(SELECTION);
  });
}

/** Appends as the application role, under a scope it sets itself. */
async function appendAs(scope: string | undefined, row: PlantedObservation): Promise<void> {
  await app.$transaction(async (tx) => {
    if (scope !== undefined) {
      await tx.$executeRaw`SELECT set_config('age.organization_id', ${scope}, true)`;
    }

    await tx.$executeRawUnsafe(
      `INSERT INTO "source_observations" ${COLUMNS} VALUES (${PLACEHOLDERS})`,
      ...values(row),
    );
  });
}

beforeAll(async () => {
  await owner.$connect();
  await app.$connect();
});

afterAll(async () => {
  await owner.$disconnect();
  await app.$disconnect();
});

beforeEach(async () => {
  await owner.$executeRawUnsafe('TRUNCATE TABLE "source_observations"');
});

describe('the connected role is the one that can be constrained', () => {
  it('is not the table owner, not a superuser, and does not bypass RLS', async () => {
    const rows = await app.$queryRaw<
      Array<{ owner: string; current: string; superuser: boolean; bypass: boolean }>
    >`
      SELECT tableowner AS "owner", current_user AS "current",
             r.rolsuper AS "superuser", r.rolbypassrls AS "bypass"
      FROM pg_tables t
      JOIN pg_roles r ON r.rolname = current_user
      WHERE t.tablename = 'source_observations'`;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.current).not.toBe(rows[0]?.owner);
    expect(rows[0]?.superuser).toBe(false);
    expect(rows[0]?.bypass).toBe(false);
  });

  it('holds SELECT and INSERT on the table and 🚫 nothing else', async () => {
    const rows = await app.$queryRaw<Array<{ privilege: string }>>`
      SELECT privilege_type AS "privilege"
      FROM information_schema.table_privileges
      WHERE table_name = 'source_observations' AND grantee = current_user`;

    expect(rows.map((row) => row.privilege).sort()).toEqual(['INSERT', 'SELECT']);
  });
});

describe('a scoped read sees its own organization, and only that', () => {
  it('returns the row it is scoped to', async () => {
    await plant(MINE);
    await plant(THEIRS);

    const rows = await readAs('org-alpha');

    expect(rows.map((row) => row['observationId'])).toEqual(['observation-mine']);
  });

  it('🚫 cannot see another organization’s observation, while the row still exists', async () => {
    await plant(MINE);
    await plant(THEIRS);

    const rows = await readAs('org-beta');

    expect(rows.map((row) => row['observationId'])).toEqual(['observation-theirs']);
    // 🛑 The pairing that makes the previous line evidence: both rows are there.
    expect(await countAsOwner()).toBe(2);
  });

  it('🛑 fails closed when nothing scoped the transaction', async () => {
    await plant(MINE);

    expect(await readAs(undefined)).toEqual([]);
    expect(await countAsOwner()).toBe(1);
  });

  it('🛑 fails closed on an empty setting — 🚫 two absences never agree', async () => {
    await plant({ ...MINE, organizationId: '' });

    expect(await readAs('')).toEqual([]);
    expect(await countAsOwner()).toBe(1);
  });
});

describe('🛑 the application role may APPEND, and only inside its own scope', () => {
  it('appends an observation under the scope it set', async () => {
    await appendAs('org-alpha', MINE);

    expect(await countAsOwner()).toBe(1);
    expect((await readAs('org-alpha')).map((row) => row['observationId'])).toEqual([
      'observation-mine',
    ]);
  });

  it('🚫 cannot append into another organization’s scope', async () => {
    await expect(appendAs('org-alpha', THEIRS)).rejects.toThrow();

    expect(await countAsOwner()).toBe(0);
  });

  it('🛑 cannot append at all when nothing scoped the transaction', async () => {
    await expect(appendAs(undefined, MINE)).rejects.toThrow();

    expect(await countAsOwner()).toBe(0);
  });
});

describe('🛑 an observation is never edited and never removed', () => {
  beforeEach(async () => {
    await plant(MINE);
  });

  it('🚫 cannot UPDATE one — a claim it can rewrite is not a record of what was said', async () => {
    await expect(
      app.$executeRaw`UPDATE "source_observations" SET "claim_direction" = 'up'`,
    ).rejects.toThrow();

    const rows = await owner.$queryRaw<Array<{ direction: string }>>`
      SELECT "claim_direction" AS "direction" FROM "source_observations"`;
    expect(rows[0]?.direction).toBe(MINE.claimDirection);
  });

  it('🚫 cannot DELETE one — a superseded observation is a NEW row, never a gone one', async () => {
    await expect(app.$executeRaw`DELETE FROM "source_observations"`).rejects.toThrow();

    expect(await countAsOwner()).toBe(1);
  });
});

describe('🛑 the database itself keeps the two subject shapes apart', () => {
  it('accepts an unmapped row with a NULL kind', async () => {
    await plant({
      ...MINE,
      observationId: 'observation-unmapped',
      subjectDisposition: 'unmapped',
      subjectKind: null,
      subjectLabel: 'widget disposal regulations',
    });

    expect(await countAsOwner()).toBe(1);
  });

  it('🚫 rejects a modelled row with no kind', async () => {
    await expect(plant({ ...MINE, subjectKind: null })).rejects.toThrow();

    expect(await countAsOwner()).toBe(0);
  });

  it('🚫 rejects an unmapped row that carries a kind', async () => {
    await expect(
      plant({ ...MINE, subjectDisposition: 'unmapped', subjectKind: 'service' }),
    ).rejects.toThrow();

    expect(await countAsOwner()).toBe(0);
  });
});

describe('a real row survives the normalizer that guards every read', () => {
  it('normalizes a planted row into the record shape, unchanged', async () => {
    await plant(MINE);

    const rows = await readAs('org-alpha');

    // ⚠️ The point is that a row from PostgreSQL — not a hand-built object — is
    // what the untrusted-input rule is applied to.
    expect(normalizeStoredObservation(rows[0])).toEqual({
      observationId: MINE.observationId,
      organizationId: MINE.organizationId,
      sourceSystem: MINE.sourceSystem,
      sourceInstance: MINE.sourceInstance,
      sourceRecordId: MINE.sourceRecordId,
      subject: { kind: 'modelled', subjectKind: 'service', label: MINE.subjectLabel },
      claim: { direction: MINE.claimDirection, materiality: MINE.claimMateriality },
      period: {
        observedAt: MINE.observedAt,
        windowStart: MINE.windowStart,
        windowEnd: MINE.windowEnd,
      },
      claimKind: MINE.claimKind,
      recordedAt: MINE.recordedAt,
    });
  });

  it('🚫 the stored time is the caller’s exact string — no `DEFAULT now()` touched it', async () => {
    await plant(MINE);

    const rows = await readAs('org-alpha');

    expect(rows[0]?.['recordedAt']).toBe('2026-08-13T00:00:00.000Z');
    expect(rows[0]?.['observedAt']).toBe('2026-07-31T00:00:00.000Z');
  });
});
