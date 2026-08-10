import { PrismaClient } from '@prisma/client';
import { normalizeSessionRecord } from '@age/session-store';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * LIVE PostgreSQL tests for `operator_sessions` (ADR-0068 §0.1b).
 *
 * EVERY ASSERTION RUNS AS THE NON-OWNER ROLE, for the reason the snapshot suite
 * gives at length: PostgreSQL exempts a superuser from RLS unconditionally and
 * the owner unless the table is FORCEd, so a policy tested on the owner
 * connection would report green even if it had been dropped. The owner is used
 * for exactly two things the app role cannot and must not do — planting rows,
 * and cleaning up between tests.
 *
 * 🛑 WHAT THIS PROVES AND WHAT IT DOES NOT. It proves the application role can
 * read only its own organization's sessions and cannot write at all. It does
 * 🚫 NOT prove isolation as an authorization property — RLS is coherence
 * (ADR-0046 D5), and the emptiness of a result set is never the proof: every
 * "cannot see" case below is paired with a row the OWNER can still count, so a
 * table that was simply empty fails.
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

interface PlantedSession {
  readonly sessionId: string;
  readonly organizationId: string;
  readonly accountId: string;
  readonly tokenHash: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

const MINE: PlantedSession = {
  sessionId: 'session-mine',
  organizationId: 'org-alpha',
  accountId: 'operator-2',
  tokenHash: 'a'.repeat(64),
  issuedAt: '2026-08-11T09:00:00.000Z',
  expiresAt: '2026-08-11T17:00:00.000Z',
  revokedAt: null,
};

const THEIRS: PlantedSession = {
  ...MINE,
  sessionId: 'session-theirs',
  organizationId: 'org-beta',
  tokenHash: 'b'.repeat(64),
};

/**
 * Plants a row as the OWNER — the act ADR-0068 §0.1c describes, performed here
 * by a fixture rather than by any code path AGE ships. 🚫 There is no
 * provisioning function to call, on purpose.
 */
async function plant(session: PlantedSession): Promise<void> {
  await owner.$executeRaw`
    INSERT INTO "operator_sessions"
      ("session_id", "organization_id", "account_id", "token_hash", "issued_at", "expires_at", "revoked_at")
    VALUES (
      ${session.sessionId}, ${session.organizationId}, ${session.accountId},
      ${session.tokenHash}, ${session.issuedAt}, ${session.expiresAt}, ${session.revokedAt}
    )`;
}

async function countAsOwner(): Promise<number> {
  const rows = await owner.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT COUNT(*)::bigint AS count FROM "operator_sessions"`;
  return Number(rows[0]?.count ?? 0);
}

/** Reads as the application role, inside a transaction scoped to one organization. */
async function readAs(organizationId: string | undefined): Promise<Array<Record<string, unknown>>> {
  return app.$transaction(async (tx) => {
    if (organizationId !== undefined) {
      await tx.$executeRaw`SELECT set_config('age.organization_id', ${organizationId}, true)`;
    }

    return tx.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "session_id" AS "sessionId", "organization_id" AS "organizationId",
             "account_id" AS "accountId", "token_hash" AS "tokenHash",
             "issued_at" AS "issuedAt", "expires_at" AS "expiresAt",
             "revoked_at" AS "revokedAt"
      FROM "operator_sessions"`;
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
  await owner.$executeRawUnsafe('TRUNCATE TABLE "operator_sessions"');
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
      WHERE t.tablename = 'operator_sessions'`;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.current).not.toBe(rows[0]?.owner);
    expect(rows[0]?.superuser).toBe(false);
    expect(rows[0]?.bypass).toBe(false);
  });

  it('holds SELECT on the table and 🚫 nothing else', async () => {
    const rows = await app.$queryRaw<Array<{ privilege: string }>>`
      SELECT privilege_type AS "privilege"
      FROM information_schema.table_privileges
      WHERE table_name = 'operator_sessions' AND grantee = current_user`;

    expect(rows.map((row) => row.privilege).sort()).toEqual(['SELECT']);
  });
});

describe('a scoped read sees its own organization, and only that', () => {
  it('returns the row it is scoped to', async () => {
    await plant(MINE);
    await plant(THEIRS);

    const rows = await readAs('org-alpha');

    expect(rows).toHaveLength(1);
    expect(rows[0]?.['sessionId']).toBe('session-mine');
  });

  it('🚫 cannot see another organization’s session, while the row still exists', async () => {
    await plant(MINE);
    await plant(THEIRS);

    const rows = await readAs('org-beta');

    expect(rows.map((row) => row['sessionId'])).toEqual(['session-theirs']);
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

describe('🛑 the application role cannot write a session — verification is not issuance', () => {
  beforeEach(async () => {
    await plant(MINE);
  });

  it('🚫 cannot INSERT one', async () => {
    await expect(
      app.$executeRaw`
        INSERT INTO "operator_sessions"
          ("session_id", "organization_id", "account_id", "token_hash", "issued_at", "expires_at", "revoked_at")
        VALUES ('forged', 'org-alpha', 'operator-2', ${'c'.repeat(64)},
                '2026-08-11T09:00:00.000Z', '2026-08-11T17:00:00.000Z', NULL)`,
    ).rejects.toThrow();

    expect(await countAsOwner()).toBe(1);
  });

  it('🚫 cannot UPDATE one — an expiry it can extend is not an expiry', async () => {
    await expect(
      app.$executeRaw`UPDATE "operator_sessions" SET "expires_at" = '2099-01-01T00:00:00.000Z'`,
    ).rejects.toThrow();

    const rows = await owner.$queryRaw<Array<{ expiresAt: string }>>`
      SELECT "expires_at" AS "expiresAt" FROM "operator_sessions"`;
    expect(rows[0]?.expiresAt).toBe(MINE.expiresAt);
  });

  it('🚫 cannot DELETE one — revocation is a column, never a missing row', async () => {
    await expect(app.$executeRaw`DELETE FROM "operator_sessions"`).rejects.toThrow();

    expect(await countAsOwner()).toBe(1);
  });
});

describe('a real row survives the normalizer that guards every read', () => {
  it('normalizes a planted row into the record shape, unchanged', async () => {
    await plant(MINE);

    const rows = await readAs('org-alpha');

    // ⚠️ The point is that a row from PostgreSQL — not a hand-built object — is
    // what the untrusted-input rule is applied to.
    expect(normalizeSessionRecord(rows[0])).toEqual({ ...MINE });
  });
});
