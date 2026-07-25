import { PrismaClient } from '@prisma/client';
import {
  mapBusinessDiscoveryToBifDraft,
  projectScoredBifContext,
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  scoreBusinessIntelligenceFramework,
  toScoredBifSnapshot,
  type ScoredBifContext,
  type ScoredBifSnapshotRecord,
} from '@age/business-discovery-contracts';
import {
  ScopedScoredBifSnapshotRepository,
  type ScoredBifSnapshotDelegate,
  type ScoredBifSnapshotScope,
  type ScoredBifSnapshotScopeRunner,
} from '@age/scored-bif-snapshot-persistence';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * LIVE PostgreSQL row-level security tests (ADR-0033, accepted as amended).
 *
 * WHAT THIS SUITE EXISTS TO AVOID. PR #109's live job connects as `age`, the
 * role that created the database and owns every object in it — and, in the CI
 * service container, the superuser. PostgreSQL exempts a superuser from RLS
 * unconditionally and the owner unless the table is FORCEd. A policy tested on
 * that connection would report green even if it restricted the wrong column, or
 * had been dropped. So every assertion below runs on a SECOND connection, as a
 * non-owner, non-superuser, NOBYPASSRLS role — and the suite asserts those three
 * attributes rather than trusting the workflow that set them (ADR-0033 D10).
 *
 * The owner connection is still used, for exactly two things the app role
 * cannot and must not do: truncating between tests, and planting rows belonging
 * to other clients and organizations so there is something to fail to see.
 *
 * IT FAILS, IT DOES NOT SKIP. Both connection strings are required.
 */

const DATABASE_URL = process.env['DATABASE_URL'];
const DATABASE_URL_APP = process.env['DATABASE_URL_APP'];

if (!DATABASE_URL || !DATABASE_URL_APP) {
  throw new Error(
    'DATABASE_URL (owner) and DATABASE_URL_APP (non-owner application role) are both required ' +
      'for the live RLS tests. The application role must be NOSUPERUSER, NOBYPASSRLS, own nothing, ' +
      'and hold only SELECT and INSERT on scored_bif_snapshots (ADR-0033 D3, D4).\n' +
      'These tests never skip: a suite that silently passes as the owner proves nothing.',
  );
}

/** Owner. Migrations, fixtures, cleanup. NEVER the subject of an RLS assertion. */
const owner = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

/** The application role. Everything this suite actually proves runs here. */
const app = new PrismaClient({ datasources: { db: { url: DATABASE_URL_APP } } });

/**
 * The composition root ADR-0033 D7 describes, in its smallest honest form: open
 * one transaction, apply both scope settings to it, and hand the operation a
 * delegate bound to that same transaction.
 *
 * `set_config(name, value, true)` is `SET LOCAL` in function form — identical
 * lifetime, transaction-local — and it takes the value as a bound parameter, so
 * a scope id can never be concatenated into SQL. A setting omitted here is
 * omitted for real: nothing else in this file sets one.
 */
function scopeRunner(
  client: PrismaClient,
  omit?: 'client' | 'organization',
): ScoredBifSnapshotScopeRunner {
  return {
    async runInScope<T>(
      scope: ScoredBifSnapshotScope,
      operation: (snapshots: ScoredBifSnapshotDelegate) => Promise<T>,
    ): Promise<T> {
      return client.$transaction(async (tx) => {
        if (omit !== 'client') {
          await tx.$executeRaw`SELECT set_config('age.client_id', ${scope.clientId}, true)`;
        }
        if (omit !== 'organization') {
          await tx.$executeRaw`SELECT set_config('age.organization_id', ${scope.organizationId}, true)`;
        }
        return operation(tx.scoredBifSnapshot as unknown as ScoredBifSnapshotDelegate);
      });
    },
  };
}

function repositoryFor(omit?: 'client' | 'organization'): ScopedScoredBifSnapshotRepository {
  return new ScopedScoredBifSnapshotRepository(scopeRunner(app, omit));
}

const MAPPER_OPTIONS = {
  organizationId: 'org-alpha',
  constructedAt: new Date('2026-07-15T09:30:00.000Z'),
  changedBy: 'analyst@example.com',
} as const;

function sampleContext(): ScoredBifContext {
  const { bif } = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, MAPPER_OPTIONS);
  const { bif: scored, metadata } = scoreBusinessIntelligenceFramework(bif);
  return projectScoredBifContext(scored, { scoringMetadata: metadata });
}

const CONTEXT = sampleContext();
const SNAPSHOT = toScoredBifSnapshot(CONTEXT);

/** Three scopes that differ in one id at a time — the whole point of the suite. */
const SCOPE_A = { clientId: 'client-a', organizationId: 'org-alpha' } as const;
/** Same organization, different client. Isolated only if `client_id` is enforced. */
const OTHER_CLIENT = { clientId: 'client-b', organizationId: 'org-alpha' } as const;
/** Same client, different organization. */
const OTHER_ORG = { clientId: 'client-a', organizationId: 'org-beta' } as const;

function recordFor(
  scope: { readonly clientId: string; readonly organizationId: string },
  snapshotId = 'snap-1',
  capturedAt = '2026-07-15T09:30:00.000Z',
): ScoredBifSnapshotRecord {
  return {
    clientId: scope.clientId,
    organizationId: scope.organizationId,
    bifId: CONTEXT.bifId,
    snapshotId,
    capturedAt,
    snapshot: SNAPSHOT,
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

/** Plants a row as the owner, bypassing RLS — a fixture, never an assertion. */
async function plant(record: ScoredBifSnapshotRecord): Promise<void> {
  await owner.$executeRaw`
    INSERT INTO "scored_bif_snapshots"
      ("client_id", "organization_id", "bif_id", "snapshot_id", "captured_at", "snapshot_version", "scoring_version", "context")
    VALUES (
      ${record.clientId}, ${record.organizationId}, ${record.bifId}, ${record.snapshotId},
      ${record.capturedAt}, ${record.snapshot.snapshotVersion},
      ${CONTEXT.metadata.scoringVersion ?? null},
      ${JSON.stringify(record.snapshot.context)}::jsonb
    )`;
}

async function countAsOwner(): Promise<number> {
  const rows = await owner.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT COUNT(*)::bigint AS count FROM "scored_bif_snapshots"`;
  return Number(rows[0]?.count ?? 0);
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
  await owner.$executeRawUnsafe('TRUNCATE TABLE "scored_bif_snapshots"');
});

describe('scored_bif_snapshots — row-level security, as the application role', () => {
  describe('the connected role', () => {
    it('is not the table owner', async () => {
      const rows = await app.$queryRaw<Array<{ owner: string; current: string }>>`
        SELECT pg_get_userbyid(relowner) AS owner, current_user::text AS current
        FROM pg_class WHERE relname = 'scored_bif_snapshots'`;

      expect(rows[0]?.owner).toBeTruthy();
      expect(rows[0]?.current).not.toBe(rows[0]?.owner);
    });

    it('is not a superuser and does not bypass RLS', async () => {
      const rows = await app.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`
        SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;

      expect(rows[0]?.rolsuper).toBe(false);
      expect(rows[0]?.rolbypassrls).toBe(false);
    });

    it('holds SELECT and INSERT and nothing else on the table', async () => {
      const rows = await app.$queryRaw<
        Array<{ sel: boolean; ins: boolean; upd: boolean; del: boolean; trunc: boolean }>
      >`
        SELECT
          has_table_privilege('scored_bif_snapshots', 'SELECT')   AS sel,
          has_table_privilege('scored_bif_snapshots', 'INSERT')   AS ins,
          has_table_privilege('scored_bif_snapshots', 'UPDATE')   AS upd,
          has_table_privilege('scored_bif_snapshots', 'DELETE')   AS del,
          has_table_privilege('scored_bif_snapshots', 'TRUNCATE') AS trunc`;

      expect(rows[0]).toEqual({ sel: true, ins: true, upd: false, del: false, trunc: false });
    });
  });

  describe('the table', () => {
    it('has row-level security enabled and forced', async () => {
      const rows = await app.$queryRaw<
        Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
      >`
        SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'scored_bif_snapshots'`;

      expect(rows[0]?.relrowsecurity).toBe(true);
      expect(rows[0]?.relforcerowsecurity).toBe(true);
    });

    it('carries exactly one SELECT policy and one INSERT policy', async () => {
      const rows = await app.$queryRaw<Array<{ cmd: string }>>`
        SELECT cmd FROM pg_policies WHERE tablename = 'scored_bif_snapshots' ORDER BY cmd`;

      expect(rows.map((row) => row.cmd)).toEqual(['INSERT', 'SELECT']);
    });
  });

  describe('in scope', () => {
    it('inserts and reads back its own snapshot', async () => {
      const repository = repositoryFor();
      const record = recordFor(SCOPE_A);

      await repository.append(record);

      expect(await repository.findBySnapshotId(keyOf(record))).toEqual(record);
      expect(await countAsOwner()).toBe(1);
    });

    it('is not vacuously restrictive: the series and latest reads return rows', async () => {
      const repository = repositoryFor();
      const first = recordFor(SCOPE_A, 'snap-1', '2026-07-15T09:30:00.000Z');
      const second = recordFor(SCOPE_A, 'snap-2', '2026-07-16T09:30:00.000Z');

      await repository.append(first);
      await repository.append(second);

      expect(await repository.listSeries(seriesKeyOf(first))).toHaveLength(2);
      expect(await repository.findLatest(seriesKeyOf(first))).toEqual(second);
    });
  });

  describe('wrong client — the boundary the amendment added', () => {
    it('cannot see another client’s row in the same organization', async () => {
      await plant(recordFor(OTHER_CLIENT));
      expect(await countAsOwner()).toBe(1);

      // The query does NOT filter on client_id. Anything hidden here is hidden
      // by the policy, not by the WHERE clause (ADR-0033 D10).
      const visible = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('age.client_id', ${SCOPE_A.clientId}, true)`;
        await tx.$executeRaw`SELECT set_config('age.organization_id', ${SCOPE_A.organizationId}, true)`;
        return tx.$queryRaw<
          Array<{ count: bigint }>
        >`SELECT COUNT(*)::bigint AS count FROM "scored_bif_snapshots"`;
      });

      expect(Number(visible[0]?.count ?? -1)).toBe(0);
    });

    it('cannot read another client’s snapshot through the adapter either', async () => {
      const planted = recordFor(OTHER_CLIENT);
      await plant(planted);

      const repository = repositoryFor();
      const asIfMine = { ...keyOf(planted), clientId: SCOPE_A.clientId };

      expect(await repository.findBySnapshotId(keyOf(planted))).toBeNull();
      expect(await repository.findBySnapshotId(asIfMine)).toBeNull();
    });

    it('cannot insert a row attributed to another client', async () => {
      const foreign = recordFor(OTHER_CLIENT);

      await expect(
        app.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('age.client_id', ${SCOPE_A.clientId}, true)`;
          await tx.$executeRaw`SELECT set_config('age.organization_id', ${SCOPE_A.organizationId}, true)`;
          await tx.$executeRaw`
            INSERT INTO "scored_bif_snapshots"
              ("client_id", "organization_id", "bif_id", "snapshot_id", "captured_at", "snapshot_version", "context")
            VALUES (${foreign.clientId}, ${foreign.organizationId}, ${foreign.bifId},
                    ${foreign.snapshotId}, ${foreign.capturedAt}, ${foreign.snapshot.snapshotVersion},
                    ${JSON.stringify(foreign.snapshot.context)}::jsonb)`;
        }),
      ).rejects.toThrow(/row-level security/i);

      expect(await countAsOwner()).toBe(0);
    });
  });

  describe('wrong organization', () => {
    it('cannot see another organization’s row for the same client', async () => {
      await plant(recordFor(OTHER_ORG));

      const visible = await app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('age.client_id', ${SCOPE_A.clientId}, true)`;
        await tx.$executeRaw`SELECT set_config('age.organization_id', ${SCOPE_A.organizationId}, true)`;
        return tx.$queryRaw<
          Array<{ count: bigint }>
        >`SELECT COUNT(*)::bigint AS count FROM "scored_bif_snapshots"`;
      });

      expect(Number(visible[0]?.count ?? -1)).toBe(0);
      expect(await countAsOwner()).toBe(1);
    });

    it('cannot insert a row attributed to another organization', async () => {
      const foreign = recordFor(OTHER_ORG);

      await expect(
        app.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('age.client_id', ${SCOPE_A.clientId}, true)`;
          await tx.$executeRaw`SELECT set_config('age.organization_id', ${SCOPE_A.organizationId}, true)`;
          await tx.$executeRaw`
            INSERT INTO "scored_bif_snapshots"
              ("client_id", "organization_id", "bif_id", "snapshot_id", "captured_at", "snapshot_version", "context")
            VALUES (${foreign.clientId}, ${foreign.organizationId}, ${foreign.bifId},
                    ${foreign.snapshotId}, ${foreign.capturedAt}, ${foreign.snapshot.snapshotVersion},
                    ${JSON.stringify(foreign.snapshot.context)}::jsonb)`;
        }),
      ).rejects.toThrow(/row-level security/i);

      expect(await countAsOwner()).toBe(0);
    });
  });

  describe('fail closed', () => {
    it('sees nothing when the client setting is missing', async () => {
      await plant(recordFor(SCOPE_A));

      const repository = repositoryFor('client');

      expect(await repository.findBySnapshotId(keyOf(recordFor(SCOPE_A)))).toBeNull();
      expect(await repository.listSeries(seriesKeyOf(recordFor(SCOPE_A)))).toEqual([]);
    });

    it('sees nothing when the organization setting is missing', async () => {
      await plant(recordFor(SCOPE_A));

      const repository = repositoryFor('organization');

      expect(await repository.findLatest(seriesKeyOf(recordFor(SCOPE_A)))).toBeNull();
    });

    it('rejects an insert when the client setting is missing', async () => {
      // Prisma wraps the driver error; match the database's own wording either
      // way rather than pinning a Prisma error class.
      await expect(repositoryFor('client').append(recordFor(SCOPE_A))).rejects.toThrow(
        /row-level security|42501/i,
      );
      expect(await countAsOwner()).toBe(0);
    });

    it('rejects an insert when the organization setting is missing', async () => {
      await expect(repositoryFor('organization').append(recordFor(SCOPE_A))).rejects.toThrow(
        /row-level security|42501/i,
      );
      expect(await countAsOwner()).toBe(0);
    });

    it('sees nothing on a connection that set no scope at all', async () => {
      await plant(recordFor(SCOPE_A));

      const rows = await app.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*)::bigint AS count FROM "scored_bif_snapshots"`;

      expect(Number(rows[0]?.count ?? -1)).toBe(0);
    });

    it('does not leak the scope past the end of its transaction', async () => {
      await plant(recordFor(SCOPE_A));

      // A scoped transaction runs and commits...
      await repositoryFor().findLatest(seriesKeyOf(recordFor(SCOPE_A)));

      // ...and the very next query on the same pooled connection is unscoped
      // again. `SET LOCAL` is what makes this true; a session `SET` would have
      // handed the scope to whoever borrowed the connection next.
      const rows = await app.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*)::bigint AS count FROM "scored_bif_snapshots"`;

      expect(Number(rows[0]?.count ?? -1)).toBe(0);
    });
  });

  describe('append-only, now at the privilege level', () => {
    it('cannot UPDATE a row it can see', async () => {
      const repository = repositoryFor();
      await repository.append(recordFor(SCOPE_A));

      await expect(
        app.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('age.client_id', ${SCOPE_A.clientId}, true)`;
          await tx.$executeRaw`SELECT set_config('age.organization_id', ${SCOPE_A.organizationId}, true)`;
          await tx.$executeRawUnsafe(
            `UPDATE "scored_bif_snapshots" SET "captured_at" = '2030-01-01T00:00:00.000Z'`,
          );
        }),
      ).rejects.toThrow(/permission denied/i);
    });

    it('cannot DELETE a row it can see', async () => {
      const repository = repositoryFor();
      await repository.append(recordFor(SCOPE_A));

      await expect(
        app.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('age.client_id', ${SCOPE_A.clientId}, true)`;
          await tx.$executeRaw`SELECT set_config('age.organization_id', ${SCOPE_A.organizationId}, true)`;
          await tx.$executeRawUnsafe('DELETE FROM "scored_bif_snapshots"');
        }),
      ).rejects.toThrow(/permission denied/i);

      expect(await countAsOwner()).toBe(1);
    });

    it('cannot TRUNCATE the table', async () => {
      await expect(app.$executeRawUnsafe('TRUNCATE TABLE "scored_bif_snapshots"')).rejects.toThrow(
        /permission denied/i,
      );
    });

    it('still rejects a duplicate identity inside its own scope', async () => {
      const repository = repositoryFor();
      const record = recordFor(SCOPE_A);

      await repository.append(record);

      await expect(repository.append(record)).rejects.toThrow(/append-only/i);
      expect(await countAsOwner()).toBe(1);
    });

    /**
     * ADR-0033 D9 asked for this to be MEASURED, not guessed: can a caller learn
     * that a key is taken under a scope it cannot see, by watching which error
     * comes back? Here the row would belong to another client, so the policy's
     * WITH CHECK rejects it. What this pins is that the attempt fails, that it
     * fails without writing anything, and that the error names the security
     * policy rather than the primary key — so nothing about the invisible row's
     * existence is disclosed. The finding is reported in the pull request.
     */
    it('does not disclose a key that exists under an invisible scope', async () => {
      const hidden = recordFor(OTHER_CLIENT, 'snap-secret');
      await plant(hidden);

      const attempt = app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('age.client_id', ${SCOPE_A.clientId}, true)`;
        await tx.$executeRaw`SELECT set_config('age.organization_id', ${SCOPE_A.organizationId}, true)`;
        await tx.$executeRaw`
          INSERT INTO "scored_bif_snapshots"
            ("client_id", "organization_id", "bif_id", "snapshot_id", "captured_at", "snapshot_version", "context")
          VALUES (${hidden.clientId}, ${hidden.organizationId}, ${hidden.bifId},
                  ${hidden.snapshotId}, ${hidden.capturedAt}, ${hidden.snapshot.snapshotVersion},
                  ${JSON.stringify(hidden.snapshot.context)}::jsonb)`;
      });

      await expect(attempt).rejects.toThrow(/row-level security/i);
      expect(await countAsOwner()).toBe(1);
    });
  });
});
