import { describe, expect, it } from 'vitest';

import { signInDirectoryRead } from '../directory-read';
import {
  PrismaDirectoryScopeRunner,
  type DirectoryScopeTransaction,
} from '../directory-scope-runner';

/**
 * ⚠️ Every fixture is obviously fictional. 🚫 No real operator, organization or
 * address appears here — obvious fictionality IS the guard.
 */

const ORGANIZATION = 'organization-fictional-alpha';
const EMAIL = 'operator@example.invalid';

const ACCOUNT_ROW = Object.freeze({
  accountId: 'account-fictional-operator',
  email: EMAIL,
  displayName: 'Fictional Operator',
  createdAt: '2026-08-01T00:00:00.000Z',
  disabledAt: null,
});

const MEMBERSHIP_ROW = Object.freeze({
  membershipId: 'membership-fictional-1',
  accountId: 'account-fictional-operator',
  scopeKind: 'agency',
  organizationId: ORGANIZATION,
  clientId: null,
  roleBundle: 'agency-operator',
  createdAt: '2026-08-01T00:00:00.000Z',
  revokedAt: null,
});

interface Recorded {
  readonly statements: string[][];
  readonly values: unknown[][];
  readonly accountWheres: unknown[];
  readonly membershipWheres: unknown[];
}

function readerOver(accountRow: unknown, membershipRows: readonly unknown[]) {
  const recorded: Recorded = {
    statements: [],
    values: [],
    accountWheres: [],
    membershipWheres: [],
  };

  const tx: DirectoryScopeTransaction = {
    $executeRaw: async (query, ...values) => {
      recorded.statements.push([...query]);
      recorded.values.push(values);
      return 1;
    },
    account: {
      findUnique: async (args) => {
        recorded.accountWheres.push(args.where);
        return accountRow;
      },
    },
    accountMembership: {
      findMany: async (args) => {
        recorded.membershipWheres.push(args.where);
        return membershipRows;
      },
    },
  };

  const read = signInDirectoryRead(
    new PrismaDirectoryScopeRunner({ $transaction: async (operation) => operation(tx) }),
    { organizationId: ORGANIZATION },
  );

  return { recorded, read };
}

describe('the directory read runs inside the scope, 🛑 always', () => {
  it('sets `age.organization_id` transaction-locally, as a BOUND parameter', async () => {
    const { recorded, read } = readerOver(ACCOUNT_ROW, [MEMBERSHIP_ROW]);

    await read(EMAIL);

    expect(recorded.statements).toHaveLength(1);
    expect(recorded.statements[0]?.join('?')).toContain("set_config('age.organization_id',");
    // 🛑 The organization is a VALUE, 🚫 never text spliced into the statement.
    expect(recorded.values[0]).toEqual([ORGANIZATION]);
    expect(recorded.statements[0]?.join('?')).toContain('true');
  });

  it('🛑 scopes BEFORE it reads — an unscoped read fails closed and looks like a stranger', async () => {
    const order: string[] = [];
    const tx: DirectoryScopeTransaction = {
      $executeRaw: async () => {
        order.push('scope');
        return 1;
      },
      account: {
        findUnique: async () => {
          order.push('account');
          return ACCOUNT_ROW;
        },
      },
      accountMembership: {
        findMany: async () => {
          order.push('memberships');
          return [MEMBERSHIP_ROW];
        },
      },
    };

    await signInDirectoryRead(
      new PrismaDirectoryScopeRunner({ $transaction: async (operation) => operation(tx) }),
      { organizationId: ORGANIZATION },
    )(EMAIL);

    expect(order).toEqual(['scope', 'account', 'memberships']);
  });

  it('⚠️ reads BOTH tables in ONE transaction — 🚫 not one scope each', async () => {
    const { recorded, read } = readerOver(ACCOUNT_ROW, [MEMBERSHIP_ROW]);

    await read(EMAIL);

    // 🛑 Two `set_config` calls would mean two transactions, and two
    // transactions can disagree about which scope they answered for.
    expect(recorded.statements).toHaveLength(1);
    expect(recorded.accountWheres).toHaveLength(1);
    expect(recorded.membershipWheres).toHaveLength(1);
  });
});

describe('what it asks, and 🚫 what it cannot ask', () => {
  it('looks the account up by the address Google verified, unchanged', async () => {
    const { recorded, read } = readerOver(ACCOUNT_ROW, [MEMBERSHIP_ROW]);

    await read(EMAIL);

    // 🚫 NOT re-lowered here. `verifiedGoogleIdentity` is the ONE place that
    // decision is taken; a second implementation is one that can disagree.
    expect(recorded.accountWheres[0]).toEqual({ email: EMAIL });
  });

  it('asks for the memberships of ONE account, 🚫 never of the whole scope', async () => {
    const { recorded, read } = readerOver(ACCOUNT_ROW, [MEMBERSHIP_ROW]);

    await read(EMAIL);

    expect(recorded.membershipWheres[0]).toEqual({ accountId: ACCOUNT_ROW.accountId });
  });

  it('🚫 does not read memberships at all when there is no account', async () => {
    const { recorded, read } = readerOver(null, [MEMBERSHIP_ROW]);

    expect(await read(EMAIL)).toEqual({ account: undefined, memberships: [] });
    expect(recorded.membershipWheres).toEqual([]);
  });
});

describe('⚠️ a stored row is UNTRUSTED INPUT and is re-validated', () => {
  it('carries a well-formed account and membership through', async () => {
    const { read } = readerOver(ACCOUNT_ROW, [MEMBERSHIP_ROW]);

    expect(await read(EMAIL)).toEqual({
      account: {
        accountId: 'account-fictional-operator',
        email: EMAIL,
        disabledAt: null,
      },
      memberships: [
        {
          membershipId: 'membership-fictional-1',
          accountId: 'account-fictional-operator',
          scopeKind: 'agency',
          organizationId: ORGANIZATION,
          clientId: null,
          roleBundle: 'agency-operator',
          revokedAt: null,
        },
      ],
    });
  });

  it('🚫 does not carry columns the decision has no business seeing', async () => {
    const { read } = readerOver(ACCOUNT_ROW, [MEMBERSHIP_ROW]);
    const entry = await read(EMAIL);

    // `displayName` and `createdAt` exist in the row and are 🚫 not passed on:
    // a decision that could read a display name is one that could branch on it.
    expect(Object.keys(entry.account ?? {}).sort()).toEqual(['accountId', 'disabledAt', 'email']);
    expect(Object.keys(entry.memberships[0] ?? {})).not.toContain('createdAt');
  });

  it('carries a revocation instant through as itself', async () => {
    const { read } = readerOver(ACCOUNT_ROW, [
      { ...MEMBERSHIP_ROW, revokedAt: '2026-08-18T08:00:00.000Z' },
    ]);

    expect((await read(EMAIL)).memberships[0]?.revokedAt).toBe('2026-08-18T08:00:00.000Z');
  });

  it.each([
    ['a missing scope kind', { scopeKind: undefined }],
    ['a blank role bundle', { roleBundle: '   ' }],
    ['a numeric membership id', { membershipId: 7 }],
    ['a missing account id', { accountId: null }],
  ])('🛑 DROPS a membership with %s rather than defaulting it', async (_label, override) => {
    // 🛑 A membership missing its `scope_kind` is 🚫 NOT an agency membership
    // with a blank kind. Defaulting one would be this module authoring a grant.
    const { read } = readerOver(ACCOUNT_ROW, [{ ...MEMBERSHIP_ROW, ...override }]);

    expect((await read(EMAIL)).memberships).toEqual([]);
  });

  it('drops only the malformed row, 🚫 never the whole read', async () => {
    const { read } = readerOver(ACCOUNT_ROW, [
      { ...MEMBERSHIP_ROW, scopeKind: undefined },
      MEMBERSHIP_ROW,
    ]);

    expect((await read(EMAIL)).memberships).toHaveLength(1);
  });

  it.each([
    ['a row that is not an object', 'not-a-row'],
    ['an array', []],
    ['an account with no id', { email: EMAIL }],
    ['an account with no email', { accountId: 'account-fictional-operator' }],
  ])('reads no account from %s', async (_label, row) => {
    const { read } = readerOver(row, []);

    expect((await read(EMAIL)).account).toBeUndefined();
  });
});
