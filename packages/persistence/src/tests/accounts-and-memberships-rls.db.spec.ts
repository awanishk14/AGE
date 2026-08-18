import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * LIVE PostgreSQL tests for `accounts` and `account_memberships`
 * (ADR-0079 §2, migration `20260818000000_accounts_memberships_and_session_issuance`).
 *
 * EVERY ASSERTION RUNS AS THE NON-OWNER ROLE, for the reason the sessions suite
 * gives at length: PostgreSQL exempts a superuser from RLS unconditionally and
 * the owner unless the table is FORCEd. The owner plants and counts, and 🚫 does
 * nothing else.
 *
 * 🛑 **WHAT THIS PROVES.** That the application role can READ an account and a
 * membership and 🚫 CANNOT MAKE ONE — ADR-0079 overturned the refusal on issuing
 * SESSIONS and 🚫 nothing else, so **AGE still mints no accounts; provisioning
 * remains a human act**. That a membership is visible only inside the
 * organization it names. That a PLATFORM membership, whose organization is NULL,
 * is invisible to every tenant by construction. And that the three legal shapes
 * are the only shapes the table will hold.
 *
 * 🚫 **WHAT IT DOES NOT PROVE.** Isolation as an authorization property — RLS is
 * coherence (ADR-0046 D5). Authorization is `@age/access-scope`, applied in
 * slice 4. Every "cannot see" below is paired with a row the OWNER still counts,
 * so a table that was simply empty fails.
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

const CREATED_AT = '2026-08-18T09:00:00.000Z';

/** 🚫 Obviously fictional, deliberately (ADR-0053 D3, ADR-0065 D1). */
const ACCOUNTS = {
  alpha: { id: 'account-alpha', email: 'alpha@example.invalid' },
  beta: { id: 'account-beta', email: 'beta@example.invalid' },
  platform: { id: 'account-platform', email: 'platform@example.invalid' },
} as const;

/** Plants as the OWNER — 🚫 there is no provisioning function to call, on purpose. */
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
  clientId: string | null,
  roleBundle: string,
): Promise<void> {
  await owner.$executeRaw`
    INSERT INTO "account_memberships"
      ("membership_id", "account_id", "scope_kind", "organization_id", "client_id", "role_bundle", "created_at", "revoked_at")
    VALUES (${membershipId}, ${accountId}, ${scopeKind}, ${organizationId}, ${clientId},
            ${roleBundle}, ${CREATED_AT}, NULL)`;
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

async function readAccountsAs(organizationId: string | undefined): Promise<string[]> {
  return app.$transaction(async (tx) => {
    if (organizationId !== undefined) {
      await tx.$executeRaw`SELECT set_config('age.organization_id', ${organizationId}, true)`;
    }

    const rows = await tx.$queryRaw<Array<{ accountId: string }>>`
      SELECT "account_id" AS "accountId" FROM "accounts" ORDER BY "account_id"`;
    return rows.map((row) => row.accountId);
  });
}

async function readMembershipsAs(organizationId: string | undefined): Promise<string[]> {
  return app.$transaction(async (tx) => {
    if (organizationId !== undefined) {
      await tx.$executeRaw`SELECT set_config('age.organization_id', ${organizationId}, true)`;
    }

    const rows = await tx.$queryRaw<Array<{ membershipId: string }>>`
      SELECT "membership_id" AS "membershipId" FROM "account_memberships" ORDER BY "membership_id"`;
    return rows.map((row) => row.membershipId);
  });
}

/** The whole fixture: two tenants, plus a platform account belonging to neither. */
async function plantTheWorld(): Promise<void> {
  await plantAccount(ACCOUNTS.alpha.id, ACCOUNTS.alpha.email);
  await plantAccount(ACCOUNTS.beta.id, ACCOUNTS.beta.email);
  await plantAccount(ACCOUNTS.platform.id, ACCOUNTS.platform.email);

  await plantMembership(
    'membership-alpha',
    ACCOUNTS.alpha.id,
    'agency',
    'org-alpha',
    null,
    'agency-operator',
  );
  await plantMembership(
    'membership-beta',
    ACCOUNTS.beta.id,
    'agency',
    'org-beta',
    null,
    'agency-operator',
  );
  await plantMembership(
    'membership-platform',
    ACCOUNTS.platform.id,
    'platform',
    null,
    null,
    'platform-operator',
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
});

describe('the connected role is the one that can be constrained', () => {
  it.each(['accounts', 'account_memberships'])(
    'is not the owner of %s, not a superuser, and does not bypass RLS',
    async (table) => {
      const rows = await app.$queryRaw<
        Array<{ owner: string; current: string; superuser: boolean; bypass: boolean }>
      >`
        SELECT tableowner AS "owner", current_user AS "current",
               r.rolsuper AS "superuser", r.rolbypassrls AS "bypass"
        FROM pg_tables t
        JOIN pg_roles r ON r.rolname = current_user
        WHERE t.tablename = ${table}`;

      expect(rows).toHaveLength(1);
      expect(rows[0]?.current).not.toBe(rows[0]?.owner);
      expect(rows[0]?.superuser).toBe(false);
      expect(rows[0]?.bypass).toBe(false);
    },
  );

  /**
   * 🛑 **AGE MINTS NOTHING, AND THIS IS WHERE THAT IS ENFORCED RATHER THAN
   * ASSERTED.** ADR-0079 §3 bought an `INSERT` on `operator_sessions` and 🚫 on
   * NOTHING ELSE. An account is created by a human; a membership is granted by a
   * human. The grant list is the only thing standing between "a sign-in page"
   * and "a sign-up page", so it is asserted EXACTLY, 🚫 never with a contains.
   */
  it.each(['accounts', 'account_memberships'])(
    'holds SELECT on %s and 🚫 nothing else — verification is not provisioning',
    async (table) => {
      const rows = await app.$queryRaw<Array<{ privilege: string }>>`
        SELECT privilege_type AS "privilege"
        FROM information_schema.table_privileges
        WHERE table_name = ${table} AND grantee = current_user`;

      expect(rows.map((row) => row.privilege).sort()).toEqual(['SELECT']);
    },
  );
});

describe('🛑 the application role can read a membership and 🚫 never create one', () => {
  beforeEach(async () => {
    await plantTheWorld();
  });

  it('🚫 cannot INSERT an account — sign-in is not sign-up', async () => {
    await expect(
      app.$executeRaw`
        INSERT INTO "accounts" ("account_id", "email", "display_name", "created_at", "disabled_at")
        VALUES ('account-forged', 'forged@example.invalid', 'Forged', ${CREATED_AT}, NULL)`,
    ).rejects.toThrow();

    expect(await countAsOwner('accounts')).toBe(3);
  });

  it('🚫 cannot INSERT a membership — a scope it can grant itself is not a scope', async () => {
    await expect(
      app.$executeRaw`
        INSERT INTO "account_memberships"
          ("membership_id", "account_id", "scope_kind", "organization_id", "client_id", "role_bundle", "created_at", "revoked_at")
        VALUES ('membership-forged', ${ACCOUNTS.beta.id}, 'platform', NULL, NULL,
                'platform-operator', ${CREATED_AT}, NULL)`,
    ).rejects.toThrow();

    expect(await countAsOwner('account_memberships')).toBe(3);
  });

  it('🚫 cannot UPDATE a membership — an escalation is an UPDATE away otherwise', async () => {
    await expect(
      app.$executeRaw`UPDATE "account_memberships" SET "role_bundle" = 'platform-operator'`,
    ).rejects.toThrow();

    const rows = await owner.$queryRaw<Array<{ roleBundle: string }>>`
      SELECT "role_bundle" AS "roleBundle" FROM "account_memberships"
      WHERE "membership_id" = 'membership-alpha'`;
    expect(rows[0]?.roleBundle).toBe('agency-operator');
  });

  it('🚫 cannot DELETE a membership — withdrawal is the owner’s act', async () => {
    await expect(app.$executeRaw`DELETE FROM "account_memberships"`).rejects.toThrow();

    expect(await countAsOwner('account_memberships')).toBe(3);
  });
});

describe('a scoped read sees its own organization, and only that', () => {
  beforeEach(async () => {
    await plantTheWorld();
  });

  it('returns the membership it is scoped to', async () => {
    expect(await readMembershipsAs('org-alpha')).toEqual(['membership-alpha']);

    // 🛑 The pairing that makes the line above evidence: all three rows exist.
    expect(await countAsOwner('account_memberships')).toBe(3);
  });

  it('🚫 cannot see another organization’s membership, while that row still exists', async () => {
    expect(await readMembershipsAs('org-beta')).toEqual(['membership-beta']);
    expect(await countAsOwner('account_memberships')).toBe(3);
  });

  it('reaches an account only through a membership in the same scope', async () => {
    expect(await readAccountsAs('org-alpha')).toEqual([ACCOUNTS.alpha.id]);
    expect(await countAsOwner('accounts')).toBe(3);
  });

  /**
   * 🛑 **THE PLATFORM TIER IS INVISIBLE TO TENANTS BY CONSTRUCTION, 🚫 NOT BY A
   * FILTER SOMEONE HAS TO REMEMBER.** A platform membership names NO
   * organization, and every policy here is an equality against the scope — so
   * there is no value of `age.organization_id` that reveals it. ⚠️ The super
   * admin's existence is the thing a tenant must not be able to enumerate.
   */
  it('🛑 never reveals the platform account or its membership to any tenant', async () => {
    for (const scope of ['org-alpha', 'org-beta', '']) {
      expect(await readMembershipsAs(scope)).not.toContain('membership-platform');
      expect(await readAccountsAs(scope)).not.toContain(ACCOUNTS.platform.id);
    }

    // 🛑 And it is really there — an absence proven against an empty table is
    // not an absence.
    expect(await countAsOwner('accounts')).toBe(3);
    expect(await countAsOwner('account_memberships')).toBe(3);
  });

  it('🛑 fails closed when nothing scoped the transaction', async () => {
    expect(await readMembershipsAs(undefined)).toEqual([]);
    expect(await readAccountsAs(undefined)).toEqual([]);
    expect(await countAsOwner('account_memberships')).toBe(3);
  });

  it('🛑 fails closed on an empty setting — 🚫 two absences never agree', async () => {
    await plantMembership(
      'membership-blank',
      ACCOUNTS.beta.id,
      'agency',
      '',
      null,
      'agency-operator',
    );

    expect(await readMembershipsAs('')).toEqual([]);
    expect(await countAsOwner('account_memberships')).toBe(4);
  });
});

/**
 * 🛑 **THE THREE SHAPES ARE THE ONLY SHAPES, AND THE DATABASE IS WHAT SAYS SO.**
 * Prisma cannot express this CHECK, so 🚫 nothing in the type system stops a
 * client membership with no client, or a platform membership carrying an
 * organization. Each is a real hole: the first authorizes a viewer against every
 * client of an agency; the second puts a platform bundle inside a tenant scope.
 *
 * ⚠️ Planted as the OWNER on purpose — the constraint must hold for the role
 * that is 🚫 NOT filtered by any policy, or it is only a policy in disguise.
 */
describe('🛑 a membership cannot be malformed', () => {
  it.each([
    ['a platform membership carrying an organization', 'platform', 'org-alpha', null],
    ['a platform membership carrying a client', 'platform', null, 'client-fictional'],
    ['an agency membership with no organization', 'agency', null, null],
    ['an agency membership carrying a client', 'agency', 'org-alpha', 'client-fictional'],
    ['a client membership with no client', 'client', 'org-alpha', null],
    ['a client membership with no organization', 'client', null, 'client-fictional'],
  ])('🚫 refuses %s', async (_case, scopeKind, organizationId, clientId) => {
    await plantAccount(ACCOUNTS.alpha.id, ACCOUNTS.alpha.email);

    await expect(
      plantMembership(
        'membership-malformed',
        ACCOUNTS.alpha.id,
        scopeKind as string,
        organizationId as string | null,
        clientId as string | null,
        'agency-operator',
      ),
    ).rejects.toThrow();

    expect(await countAsOwner('account_memberships')).toBe(0);
  });

  it('accepts each of the three legal shapes — so the CHECK is not simply refusing everything', async () => {
    await plantAccount(ACCOUNTS.alpha.id, ACCOUNTS.alpha.email);

    await plantMembership(
      'm-platform',
      ACCOUNTS.alpha.id,
      'platform',
      null,
      null,
      'platform-operator',
    );
    await plantMembership(
      'm-agency',
      ACCOUNTS.alpha.id,
      'agency',
      'org-alpha',
      null,
      'agency-operator',
    );
    await plantMembership(
      'm-client',
      ACCOUNTS.alpha.id,
      'client',
      'org-alpha',
      'client-fictional',
      'client-viewer',
    );

    expect(await countAsOwner('account_memberships')).toBe(3);
  });

  it('🚫 refuses a scope kind and a role bundle that are not in the enumeration', async () => {
    await plantAccount(ACCOUNTS.alpha.id, ACCOUNTS.alpha.email);

    await expect(
      plantMembership(
        'm-bad-kind',
        ACCOUNTS.alpha.id,
        'superuser',
        null,
        null,
        'platform-operator',
      ),
    ).rejects.toThrow();
    await expect(
      plantMembership('m-bad-bundle', ACCOUNTS.alpha.id, 'platform', null, null, 'root'),
    ).rejects.toThrow();

    expect(await countAsOwner('account_memberships')).toBe(0);
  });

  it('🚫 refuses a second membership at the same position', async () => {
    await plantAccount(ACCOUNTS.alpha.id, ACCOUNTS.alpha.email);
    await plantMembership(
      'm-first',
      ACCOUNTS.alpha.id,
      'agency',
      'org-alpha',
      null,
      'agency-operator',
    );

    // ⚠️ Two bundles at one position is two answers to "what may this account do
    // here", and 🚫 the higher one always wins by accident.
    await expect(
      plantMembership('m-second', ACCOUNTS.alpha.id, 'agency', 'org-alpha', null, 'client-viewer'),
    ).rejects.toThrow();

    expect(await countAsOwner('account_memberships')).toBe(1);
  });

  it('🚫 refuses a second account at the same email', async () => {
    await plantAccount(ACCOUNTS.alpha.id, ACCOUNTS.alpha.email);

    await expect(plantAccount('account-duplicate', ACCOUNTS.alpha.email)).rejects.toThrow();

    expect(await countAsOwner('accounts')).toBe(1);
  });
});
