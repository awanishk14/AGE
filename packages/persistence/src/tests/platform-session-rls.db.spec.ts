import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * LIVE PostgreSQL tests for ADR-0082's three additive policies
 * (migration `20260819100000_platform_sessions_without_an_organization`).
 *
 * EVERY ASSERTION RUNS AS THE NON-OWNER ROLE. PostgreSQL exempts a superuser
 * from RLS unconditionally, and the owner unless the table is FORCEd, so a
 * suite that ran as the owner would pass against no policies at all. The owner
 * plants and counts, and 🚫 does nothing else.
 *
 * 🛑 **WHAT THIS PROVES.** That a session whose organization is NULL — the shape
 * the Product Owner chose in their own words, *"no organisation id"* — can be
 * read, issued and revoked when, and 🚫 ONLY when, `age.platform_session_token_hash`
 * names that exact digest. That the fence is the DIGEST: another digest reaches
 * nothing, and 🚫 the setting cannot enumerate platform sessions. That it is 🚫
 * **NOT a skeleton key** — with it present, tenant sessions stay exactly as
 * invisible and as unwritable as they were. And that with the setting ABSENT,
 * every pre-existing tenant read, insert and revoke is unchanged (ADR-0082 D2).
 *
 * 🚫 **WHAT IT DOES NOT PROVE.** Isolation as an authorization property — RLS is
 * coherence (ADR-0046 D5), and authorization is `@age/access-scope`. It proves
 * nothing about ADMISSION either: `decideSignIn` still refuses a platform
 * membership, and nothing in AGE yet sets this setting. 🛑 **AGE still mints
 * nothing** — the account and membership that make a person a platform operator
 * are planted here by the OWNER, exactly as they are provisioned in production:
 * as a human act, by no code path AGE ships.
 *
 * ⚠️ **EVERY "CANNOT SEE" AND "CANNOT WRITE" IS PAIRED WITH A ROW THE OWNER
 * STILL COUNTS**, so a table that was simply empty fails rather than passes.
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
  readonly organizationId: string | null;
  readonly accountId: string;
  readonly tokenHash: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

const ISSUED_AT = '2026-08-19T09:00:00.000Z';
const EXPIRES_AT = '2026-08-19T17:00:00.000Z';
const REVOKED_AT = '2026-08-19T10:00:00.000Z';

const TENANT_ORGANIZATION = 'org-alpha';

/** 🚫 Obviously fictional, deliberately. Digests are the right LENGTH and nothing more. */
const PLATFORM: PlantedSession = {
  sessionId: 'session-platform',
  organizationId: null,
  accountId: 'account-platform',
  tokenHash: 'a'.repeat(64),
  issuedAt: ISSUED_AT,
  expiresAt: EXPIRES_AT,
  revokedAt: null,
};

/**
 * ⚠️ **A SECOND PLATFORM SESSION IS THE POINT.** If the fence were "is a
 * platform session" rather than "is THIS digest", this row would appear, and
 * the reader would be a directory of who is currently signed in as an operator.
 */
const OTHER_PLATFORM: PlantedSession = {
  ...PLATFORM,
  sessionId: 'session-platform-other',
  accountId: 'account-platform-two',
  tokenHash: 'b'.repeat(64),
};

const TENANT: PlantedSession = {
  ...PLATFORM,
  sessionId: 'session-tenant',
  organizationId: TENANT_ORGANIZATION,
  accountId: 'account-alpha',
  tokenHash: 'c'.repeat(64),
};

const UNKNOWN_DIGEST = 'd'.repeat(64);

/**
 * Plants a row as the OWNER — the provisioning act AGE ships no code for.
 * 🚫 There is no function to call here, on purpose.
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

async function revokedAtAsOwner(sessionId: string): Promise<string | null> {
  const rows = await owner.$queryRaw<Array<{ revoked_at: string | null }>>`
    SELECT "revoked_at" FROM "operator_sessions" WHERE "session_id" = ${sessionId}`;

  return rows[0]?.revoked_at ?? null;
}

interface Settings {
  readonly platformTokenHash?: string;
  readonly organizationId?: string;
}

/**
 * ⚠️ **`set_config(..., true)` IS `SET LOCAL` IN FUNCTION FORM** — it takes a
 * BOUND PARAMETER, which `SET LOCAL` cannot, and its lifetime is the
 * transaction. Behind a pool that matters: a session-level setting would leak to
 * whoever borrowed the connection next.
 */
async function applySettings(
  tx: { $executeRaw(q: TemplateStringsArray, ...v: unknown[]): Promise<unknown> },
  settings: Settings,
): Promise<void> {
  if (settings.platformTokenHash !== undefined) {
    await tx.$executeRaw`SELECT set_config('age.platform_session_token_hash', ${settings.platformTokenHash}, true)`;
  }
  if (settings.organizationId !== undefined) {
    await tx.$executeRaw`SELECT set_config('age.organization_id', ${settings.organizationId}, true)`;
  }
}

/** What the APPLICATION role can see, under the given settings. */
async function visibleSessionIds(settings: Settings): Promise<string[]> {
  return app.$transaction(async (tx) => {
    await applySettings(tx, settings);

    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "session_id" AS "id" FROM "operator_sessions" ORDER BY "session_id"`;

    return rows.map((row) => row.id);
  });
}

/** Attempts an insert as the APPLICATION role; returns whether it landed. */
async function tryIssue(settings: Settings, session: PlantedSession): Promise<boolean> {
  try {
    await app.$transaction(async (tx) => {
      await applySettings(tx, settings);
      await tx.$executeRaw`
        INSERT INTO "operator_sessions"
          ("session_id", "organization_id", "account_id", "token_hash", "issued_at", "expires_at", "revoked_at")
        VALUES (
          ${session.sessionId}, ${session.organizationId}, ${session.accountId},
          ${session.tokenHash}, ${session.issuedAt}, ${session.expiresAt}, ${session.revokedAt}
        )`;
    });

    return true;
  } catch {
    // ⚠️ The REFUSAL is the result being asserted. 🚫 The error is not inspected:
    // classifying a database error is not this layer's business (ADR-0036 D8),
    // and the caller's own count is what proves the row did not land.
    return false;
  }
}

/** Attempts to revoke as the APPLICATION role; returns the number of rows it reached. */
async function tryRevoke(settings: Settings, tokenHash: string): Promise<number> {
  return app.$transaction(async (tx) => {
    await applySettings(tx, settings);

    return (await tx.$executeRaw`
      UPDATE "operator_sessions" SET "revoked_at" = ${REVOKED_AT}
      WHERE "token_hash" = ${tokenHash}`) as unknown as number;
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
  await plant(PLATFORM);
  await plant(OTHER_PLATFORM);
  await plant(TENANT);
});

describe('🛑 the store can now HOLD a session that belongs to no organization', () => {
  it('accepts a NULL organization at all — the column is nullable', async () => {
    // ⚠️ Planted in `beforeEach` as the owner. If `DROP NOT NULL` had not been
    // applied, every case in this file would fail in setup rather than here,
    // so this asserts it where the failure is legible.
    expect(await countAsOwner()).toBe(3);
  });
});

describe('🛑 the setting is the whole fence — without it, nothing changed (ADR-0082 D2)', () => {
  it('leaves a platform session invisible when no setting is set', async () => {
    expect(await visibleSessionIds({})).toEqual([]);
    // ⚠️ Paired with planted rows, so an empty table cannot pass this.
    expect(await countAsOwner()).toBe(3);
  });

  it('leaves the tenant read byte-for-byte what it already was', async () => {
    // 🛑 THE REGRESSION THAT MATTERS. Permissive policies OR, so the new ones
    // must be inert while their setting is absent. A tenant that could now see
    // one extra row would be this migration widening a guard.
    expect(await visibleSessionIds({ organizationId: TENANT_ORGANIZATION })).toEqual([
      TENANT.sessionId,
    ]);
  });

  it('leaves the tenant issue path unchanged — in scope lands, out of scope refuses', async () => {
    const inScope = { ...TENANT, sessionId: 'session-tenant-new', tokenHash: 'e'.repeat(64) };
    const otherTenant = {
      ...inScope,
      sessionId: 'session-beta-new',
      organizationId: 'org-beta',
      tokenHash: 'f'.repeat(64),
    };

    expect(await tryIssue({ organizationId: TENANT_ORGANIZATION }, inScope)).toBe(true);
    expect(await tryIssue({ organizationId: TENANT_ORGANIZATION }, otherTenant)).toBe(false);
    expect(await countAsOwner()).toBe(4);
  });

  it('leaves the tenant revoke path unchanged', async () => {
    expect(await tryRevoke({ organizationId: TENANT_ORGANIZATION }, TENANT.tokenHash)).toBe(1);
    expect(await revokedAtAsOwner(TENANT.sessionId)).toBe(REVOKED_AT);
  });
});

describe('🛑 with the setting, the database answers about ONE digest', () => {
  it('reveals the session the digest names', async () => {
    expect(await visibleSessionIds({ platformTokenHash: PLATFORM.tokenHash })).toEqual([
      PLATFORM.sessionId,
    ]);
  });

  it('🚫 reveals NO OTHER platform session, though one exists', async () => {
    const visible = await visibleSessionIds({ platformTokenHash: PLATFORM.tokenHash });

    expect(visible).not.toContain(OTHER_PLATFORM.sessionId);
    expect(await countAsOwner()).toBe(3);
  });

  it('🚫 reveals nothing for a digest that exists nowhere', async () => {
    expect(await visibleSessionIds({ platformTokenHash: UNKNOWN_DIGEST })).toEqual([]);
  });

  it('🚫 reveals a TENANT session even when its digest is the one named', async () => {
    // 🛑 THE FENCE IS BOTH CLAUSES. Naming a tenant session's digest through the
    // platform setting must reach nothing: `organization_id IS NULL` is what
    // stops this setting from becoming a cross-tenant lookup by digest.
    expect(await visibleSessionIds({ platformTokenHash: TENANT.tokenHash })).toEqual([]);
    expect(await countAsOwner()).toBe(3);
  });

  it('🚫 lets an empty setting behave as if it were set', async () => {
    // ⚠️ `NULLIF(..., '')` is what makes this true, and an empty string is
    // exactly what a caller passing "no digest" would produce.
    expect(await visibleSessionIds({ platformTokenHash: '' })).toEqual([]);
  });

  it('keeps a revoked platform session VISIBLE, deliberately', async () => {
    // 🛑 REVOCATION IS NOT ENFORCED BY HIDING THE ROW. `@age/session-store` has
    // one implementation of that decision. A policy that hid it would report a
    // revoked session as `no-such-session`, collapsing "AGE holds a row it has
    // decided against" into "AGE holds no such row" — the exact distinction the
    // verifier exists to make.
    await owner.$executeRaw`
      UPDATE "operator_sessions" SET "revoked_at" = ${REVOKED_AT}
      WHERE "session_id" = ${PLATFORM.sessionId}`;

    expect(await visibleSessionIds({ platformTokenHash: PLATFORM.tokenHash })).toEqual([
      PLATFORM.sessionId,
    ]);
  });
});

describe('🛑 issuing a platform session — pinned to the digest, and 🚫 nowhere else', () => {
  const FRESH: PlantedSession = {
    ...PLATFORM,
    sessionId: 'session-platform-fresh',
    tokenHash: 'e'.repeat(64),
  };

  it('lands when the setting names the digest of the row being written', async () => {
    expect(await tryIssue({ platformTokenHash: FRESH.tokenHash }, FRESH)).toBe(true);
    expect(await countAsOwner()).toBe(4);
  });

  it('🚫 lands when the transaction set no digest at all', async () => {
    expect(await tryIssue({}, FRESH)).toBe(false);
    expect(await countAsOwner()).toBe(3);
  });

  it('🚫 lands a row whose digest is not the one the setting names', async () => {
    // 🛑 A transaction cannot issue a session it did not mint the token for.
    expect(await tryIssue({ platformTokenHash: UNKNOWN_DIGEST }, FRESH)).toBe(false);
    expect(await countAsOwner()).toBe(3);
  });

  it('🚫 lands a TENANT row through the platform setting', async () => {
    // 🛑 THE TWO INSERT POLICIES ARE DISJOINT BY CONSTRUCTION. One demands a
    // matching organization; the other demands none at all. Neither admits the
    // row the other governs, so the platform setting is 🚫 not a way to write
    // into a tenant nobody named.
    const tenantRow = {
      ...FRESH,
      sessionId: 'session-tenant-smuggled',
      organizationId: TENANT_ORGANIZATION,
    };

    expect(await tryIssue({ platformTokenHash: FRESH.tokenHash }, tenantRow)).toBe(false);
    expect(await countAsOwner()).toBe(3);
  });
});

describe('🛑 revoking a platform session — logout works, and 🚫 reaches nothing else', () => {
  it('revokes the session whose digest the setting names', async () => {
    // ⚠️ ADR-0074 D3 is not suspended for a platform operator: a logout that
    // only clears a cookie is not a logout, because the token still verifies.
    expect(await tryRevoke({ platformTokenHash: PLATFORM.tokenHash }, PLATFORM.tokenHash)).toBe(1);
    expect(await revokedAtAsOwner(PLATFORM.sessionId)).toBe(REVOKED_AT);
  });

  it('🚫 reaches the OTHER platform session, whose digest was not named', async () => {
    expect(
      await tryRevoke({ platformTokenHash: PLATFORM.tokenHash }, OTHER_PLATFORM.tokenHash),
    ).toBe(0);
    expect(await revokedAtAsOwner(OTHER_PLATFORM.sessionId)).toBeNull();
  });

  it('🚫 reaches a TENANT session', async () => {
    expect(await tryRevoke({ platformTokenHash: TENANT.tokenHash }, TENANT.tokenHash)).toBe(0);
    // ⚠️ Paired with the owner's read, so "zero rows" cannot be a missing row.
    expect(await revokedAtAsOwner(TENANT.sessionId)).toBeNull();
  });

  it('🚫 reaches anything when no digest is set', async () => {
    expect(await tryRevoke({}, PLATFORM.tokenHash)).toBe(0);
    expect(await revokedAtAsOwner(PLATFORM.sessionId)).toBeNull();
  });
});

describe('🛑 the grant is still the outer fence, whatever a policy permits', () => {
  it('🚫 lets the application role rewrite a platform session’s organization', async () => {
    // 🛑 `GRANT UPDATE ("revoked_at")` — a COLUMN-LEVEL grant. PostgreSQL
    // rejects an UPDATE touching any other column, so a platform session cannot
    // be re-tenanted, its expiry cannot be moved and its digest cannot be
    // repointed, EVEN THOUGH the platform UPDATE policy would match the row.
    // ⚠️ This is the fence the policy scan cannot see.
    let refused = false;

    try {
      await app.$transaction(async (tx) => {
        await applySettings(tx, { platformTokenHash: PLATFORM.tokenHash });
        await tx.$executeRaw`
          UPDATE "operator_sessions" SET "organization_id" = ${TENANT_ORGANIZATION}
          WHERE "token_hash" = ${PLATFORM.tokenHash}`;
      });
    } catch {
      refused = true;
    }

    expect(refused).toBe(true);
  });

  it('🚫 lets the application role delete a platform session', async () => {
    let refused = false;

    try {
      await app.$transaction(async (tx) => {
        await applySettings(tx, { platformTokenHash: PLATFORM.tokenHash });
        await tx.$executeRaw`
          DELETE FROM "operator_sessions" WHERE "token_hash" = ${PLATFORM.tokenHash}`;
      });
    } catch {
      refused = true;
    }

    expect(refused).toBe(true);
    expect(await countAsOwner()).toBe(3);
  });
});
