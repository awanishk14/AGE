import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * LIVE PostgreSQL tests for ADR-0080 Option A's two additive policies
 * (migration `20260819000000_platform_membership_sign_in_read`).
 *
 * EVERY ASSERTION RUNS AS THE NON-OWNER ROLE. PostgreSQL exempts a superuser
 * from RLS unconditionally, and the owner unless the table is FORCEd, so a
 * suite that ran as the owner would pass against no policies at all. The owner
 * plants and counts, and 🚫 does nothing else.
 *
 * 🛑 **WHAT THIS PROVES.** That a platform membership — whose organization is
 * NULL, and which is therefore invisible to every equality-compared tenant
 * policy — becomes readable when, and 🚫 ONLY when, `age.platform_sign_in_email`
 * names that exact account. That the fence is the ADDRESS: another address
 * reaches nothing. That the setting is 🚫 **NOT a skeleton key** — with it
 * present, tenant accounts and tenant memberships stay exactly as invisible as
 * they were. And that with the setting ABSENT, every pre-existing tenant read is
 * unchanged.
 *
 * 🚫 **WHAT IT DOES NOT PROVE.** Isolation as an authorization property — RLS is
 * coherence (ADR-0046 D5), and authorization is `@age/access-scope`. It also
 * proves nothing about ADMISSION: `decideSignIn` still refuses a platform
 * membership, and 🛑 **AGE still mints nothing.**
 *
 * ⚠️ **EVERY "CANNOT SEE" IS PAIRED WITH A ROW THE OWNER STILL COUNTS**, so a
 * table that was simply empty fails rather than passes.
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

const CREATED_AT = '2026-08-19T09:00:00.000Z';

/** 🚫 Obviously fictional, deliberately (ADR-0053 D3, ADR-0065 D1). */
const ACCOUNTS = {
  platform: { id: 'account-platform', email: 'platform@example.invalid' },
  secondPlatform: { id: 'account-platform-two', email: 'platform-two@example.invalid' },
  tenant: { id: 'account-alpha', email: 'alpha@example.invalid' },
  revokedPlatform: { id: 'account-platform-revoked', email: 'platform-revoked@example.invalid' },
} as const;

const UNKNOWN_EMAIL = 'stranger@example.invalid';
const TENANT_ORGANIZATION = 'org-alpha';

async function plantAccount(accountId: string, email: string): Promise<void> {
  await owner.$executeRaw`
    INSERT INTO "accounts" ("account_id", "email", "display_name", "created_at", "disabled_at")
    VALUES (${accountId}, ${email}, ${'Fictional Operator'}, ${CREATED_AT}, NULL)`;
}

async function plantMembership(
  membershipId: string,
  accountId: string,
  scopeKind: string,
  organizationId: string | null,
  roleBundle: string,
  revokedAt: string | null,
): Promise<void> {
  await owner.$executeRaw`
    INSERT INTO "account_memberships"
      ("membership_id", "account_id", "scope_kind", "organization_id", "client_id", "role_bundle", "created_at", "revoked_at")
    VALUES (${membershipId}, ${accountId}, ${scopeKind}, ${organizationId}, ${null},
            ${roleBundle}, ${CREATED_AT}, ${revokedAt})`;
}

async function countAsOwner(table: 'accounts' | 'account_memberships'): Promise<number> {
  const rows =
    table === 'accounts'
      ? await owner.$queryRaw<
          Array<{ count: bigint }>
        >`SELECT COUNT(*)::bigint AS count FROM "accounts"`
      : await owner.$queryRaw<
          Array<{ count: bigint }>
        >`SELECT COUNT(*)::bigint AS count FROM "account_memberships"`;

  return Number(rows[0]?.count ?? 0);
}

interface Settings {
  readonly platformEmail?: string;
  readonly organizationId?: string;
}

/**
 * ⚠️ **`set_config(..., true)` IS `SET LOCAL` IN FUNCTION FORM** — it takes a
 * BOUND PARAMETER, which `SET LOCAL` cannot, and its lifetime is the
 * transaction. Behind a pool that matters: a session-level setting would leak to
 * whoever borrowed the connection next.
 */
async function readIds(settings: Settings, column: 'account' | 'membership'): Promise<string[]> {
  return app.$transaction(async (tx) => {
    if (settings.platformEmail !== undefined) {
      await tx.$executeRaw`SELECT set_config('age.platform_sign_in_email', ${settings.platformEmail}, true)`;
    }
    if (settings.organizationId !== undefined) {
      await tx.$executeRaw`SELECT set_config('age.organization_id', ${settings.organizationId}, true)`;
    }

    if (column === 'account') {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "account_id" AS "id" FROM "accounts" ORDER BY "account_id"`;
      return rows.map((row) => row.id);
    }

    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "membership_id" AS "id" FROM "account_memberships" ORDER BY "membership_id"`;
    return rows.map((row) => row.id);
  });
}

function visibleAccountIds(settings: Settings): Promise<string[]> {
  return readIds(settings, 'account');
}

function visibleMembershipIds(settings: Settings): Promise<string[]> {
  return readIds(settings, 'membership');
}

/** Two platform operators, one tenant operator, one revoked platform operator. */
async function plantTheWorld(): Promise<void> {
  await plantAccount(ACCOUNTS.platform.id, ACCOUNTS.platform.email);
  await plantAccount(ACCOUNTS.secondPlatform.id, ACCOUNTS.secondPlatform.email);
  await plantAccount(ACCOUNTS.tenant.id, ACCOUNTS.tenant.email);
  await plantAccount(ACCOUNTS.revokedPlatform.id, ACCOUNTS.revokedPlatform.email);

  await plantMembership(
    'membership-platform',
    ACCOUNTS.platform.id,
    'platform',
    null,
    'platform-operator',
    null,
  );
  await plantMembership(
    'membership-platform-two',
    ACCOUNTS.secondPlatform.id,
    'platform',
    null,
    'platform-operator',
    null,
  );
  await plantMembership(
    'membership-alpha',
    ACCOUNTS.tenant.id,
    'agency',
    TENANT_ORGANIZATION,
    'agency-operator',
    null,
  );
  await plantMembership(
    'membership-platform-revoked',
    ACCOUNTS.revokedPlatform.id,
    'platform',
    null,
    'platform-operator',
    CREATED_AT,
  );
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
  await owner.$executeRawUnsafe('TRUNCATE TABLE "account_memberships"');
  await owner.$executeRawUnsafe('TRUNCATE TABLE "accounts"');
  await plantTheWorld();
});

describe('🛑 the setting is the whole fence — without it, nothing changed', () => {
  it('leaves a platform account invisible when no setting is set', async () => {
    expect(await visibleAccountIds({})).toEqual([]);
    // ⚠️ Paired with planted rows, so an empty table cannot pass this.
    expect(await countAsOwner('accounts')).toBe(4);
  });

  it('leaves the tenant read byte-for-byte what it already was', async () => {
    // 🛑 THE REGRESSION THAT MATTERS. Permissive policies OR, so the new ones
    // must be inert while their setting is absent. A tenant that could now see
    // one extra row would be this migration widening a guard.
    expect(await visibleAccountIds({ organizationId: TENANT_ORGANIZATION })).toEqual([
      ACCOUNTS.tenant.id,
    ]);
    expect(await visibleMembershipIds({ organizationId: TENANT_ORGANIZATION })).toEqual([
      'membership-alpha',
    ]);
  });
});

describe('🛑 with the setting, the database answers about ONE address', () => {
  it('reveals the account the setting names', async () => {
    expect(await visibleAccountIds({ platformEmail: ACCOUNTS.platform.email })).toEqual([
      ACCOUNTS.platform.id,
    ]);
  });

  it('🚫 reveals NO OTHER platform account, though one exists', async () => {
    // ⚠️ THE SECOND PLATFORM OPERATOR IS THE POINT. If the fence were "is a
    // platform operator" rather than "is THIS address", this row would appear,
    // and the reader would be a directory of who runs the platform.
    const visible = await visibleAccountIds({ platformEmail: ACCOUNTS.platform.email });

    expect(visible).not.toContain(ACCOUNTS.secondPlatform.id);
    expect(await countAsOwner('accounts')).toBe(4);
  });

  it('🚫 reveals nothing at all for an address that is not a platform operator', async () => {
    expect(await visibleAccountIds({ platformEmail: ACCOUNTS.tenant.email })).toEqual([]);
  });

  it('🚫 reveals nothing at all for an address that exists nowhere', async () => {
    expect(await visibleAccountIds({ platformEmail: UNKNOWN_EMAIL })).toEqual([]);
  });

  it('🚫 reveals a platform account whose membership was REVOKED', async () => {
    // ⚠️ A revoked operator is a refused sign-in, 🚫 not a downgraded one, and
    // the refusal begins here rather than in TypeScript.
    expect(await visibleAccountIds({ platformEmail: ACCOUNTS.revokedPlatform.email })).toEqual([]);
    expect(await countAsOwner('account_memberships')).toBe(4);
  });
});

describe('🛑 the setting is 🚫 NOT a skeleton key', () => {
  it('🚫 opens no tenant account, even while it is present', async () => {
    const visible = await visibleAccountIds({ platformEmail: ACCOUNTS.platform.email });

    expect(visible).not.toContain(ACCOUNTS.tenant.id);
  });

  it('🚫 opens no tenant membership, even while it is present', async () => {
    // 🛑 THE HONEST COST, ASSERTED RATHER THAN GLOSSED. The membership policy
    // does reveal the live PLATFORM memberships while the setting is present —
    // opaque ids and NULLs, 🚫 no address, no name, no client, no tenant. What
    // it must NEVER reveal is a row belonging to a tenant, and that is the line
    // this pins.
    const visible = await visibleMembershipIds({ platformEmail: ACCOUNTS.platform.email });

    expect(visible).not.toContain('membership-alpha');
    expect(visible).not.toContain('membership-platform-revoked');
    expect(visible).toEqual(['membership-platform', 'membership-platform-two']);
  });

  it('🚫 lets an empty setting behave as if it were set', async () => {
    // ⚠️ `NULLIF(..., '')` is what makes this true, and an empty string is
    // exactly what a caller passing "no email" would produce.
    expect(await visibleAccountIds({ platformEmail: '' })).toEqual([]);
    expect(await visibleMembershipIds({ platformEmail: '' })).toEqual([]);
  });
});
