import { describe, expect, it } from 'vitest';

import {
  PrismaPlatformAccountRunner,
  platformDirectoryReadByAccount,
} from '../platform-account-read';
import type { DirectoryScopeTransaction } from '../directory-scope-runner';

/**
 * **ADR-0089 §7 — THE ACCOUNT-KEYED PLATFORM READ.**
 *
 * 🛑 **THE FENCE IS THE WHOLE POINT, SO THE FENCE IS WHAT IS ASSERTED.** This
 * read exists because the platform arm of `requireRequestScope` did no re-read
 * at all, and the ONLY reason a third path to these two tables is tolerable is
 * that it is narrower than the door it replaces: one proved account id, 🚫 no
 * organization, 🚫 no enumeration, 🚫 no write, and a setting established BEFORE
 * anything reads.
 *
 * 🛑 **NO CASE HERE ASSERTS AN EMPTY RESULT AS PROOF OF ANYTHING.** An empty
 * read proves the fence held OR that the fixture was empty, and the two are
 * indistinguishable. Every case below asserts what was ASKED.
 *
 * ⚠️ Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const ACCOUNT = 'account-fictional-platform';

const ACCOUNT_ROW = Object.freeze({
  accountId: ACCOUNT,
  email: 'platform@example.invalid',
  displayName: 'Fictional Platform Operator',
  createdAt: '2026-08-01T00:00:00.000Z',
  disabledAt: null,
});

const MEMBERSHIP_ROW = Object.freeze({
  membershipId: 'membership-fictional-platform',
  accountId: ACCOUNT,
  scopeKind: 'platform',
  organizationId: null,
  clientId: null,
  roleBundle: 'platform-operator',
  createdAt: '2026-08-01T00:00:00.000Z',
  revokedAt: null,
});

interface Recorded {
  readonly order: string[];
  readonly statements: string[][];
  readonly values: unknown[][];
  readonly accountWheres: unknown[];
  readonly membershipWheres: unknown[];
}

function readerOver(accountRow: unknown, membershipRows: readonly unknown[]) {
  const recorded: Recorded = {
    order: [],
    statements: [],
    values: [],
    accountWheres: [],
    membershipWheres: [],
  };

  const tx: DirectoryScopeTransaction = {
    $executeRaw: async (query, ...values) => {
      recorded.order.push('scope');
      recorded.statements.push([...query]);
      recorded.values.push(values);
      return 1;
    },
    account: {
      findUnique: async (args) => {
        recorded.order.push('account');
        recorded.accountWheres.push(args.where);
        return accountRow;
      },
    },
    accountMembership: {
      findMany: async (args) => {
        recorded.order.push('memberships');
        recorded.membershipWheres.push(args.where);
        return membershipRows;
      },
    },
  };

  const read = platformDirectoryReadByAccount(
    new PrismaPlatformAccountRunner({ $transaction: async (operation) => operation(tx) }),
  );

  return { recorded, read };
}

describe('🛑 the account-keyed platform read runs inside its own fence, always', () => {
  it('sets `age.platform_sign_in_account` transaction-locally, as a BOUND parameter', async () => {
    const { recorded, read } = readerOver(ACCOUNT_ROW, [MEMBERSHIP_ROW]);

    await read(ACCOUNT);

    expect(recorded.statements).toHaveLength(1);
    expect(recorded.statements[0]?.join('?')).toContain(
      "set_config('age.platform_sign_in_account',",
    );
    // 🛑 The account id is a VALUE, 🚫 never text spliced into the statement.
    expect(recorded.values[0]).toEqual([ACCOUNT]);
    // ⚠️ Transaction-local. Behind a pool, a session-level setting would leak to
    // whoever borrows the connection next — the NEXT request reading with a
    // PREVIOUS operator's account still set.
    expect(recorded.statements[0]?.join('?')).toContain('true');
  });

  it('🛑 sets the fence BEFORE it reads — an unfenced read sees nothing and looks like a stranger', async () => {
    const { recorded, read } = readerOver(ACCOUNT_ROW, [MEMBERSHIP_ROW]);

    await read(ACCOUNT);

    expect(recorded.order).toEqual(['scope', 'account', 'memberships']);
  });

  it('🚫 NEVER sets the tenant scope or the address fence on this transaction', async () => {
    const { recorded, read } = readerOver(ACCOUNT_ROW, [MEMBERSHIP_ROW]);

    await read(ACCOUNT);

    const statement = recorded.statements.map((parts) => parts.join('?')).join('\n');

    // 🛑 A transaction that were BOTH would OR the tenant policies' rows in, and
    // a platform request would read an agency's people.
    expect(statement).not.toContain('age.organization_id');
    expect(statement).not.toContain('age.platform_sign_in_email');
  });

  it('⚠️ reads BOTH tables in ONE transaction — 🚫 not one fence each', async () => {
    const { recorded, read } = readerOver(ACCOUNT_ROW, [MEMBERSHIP_ROW]);

    await read(ACCOUNT);

    expect(recorded.statements).toHaveLength(1);
    expect(recorded.accountWheres).toHaveLength(1);
    expect(recorded.membershipWheres).toHaveLength(1);
  });
});

describe('what it asks, and 🚫 what it cannot ask', () => {
  it('looks the account up by the id the SESSION proved, unchanged', async () => {
    const { recorded, read } = readerOver(ACCOUNT_ROW, [MEMBERSHIP_ROW]);

    await read(ACCOUNT);

    expect(recorded.accountWheres[0]).toEqual({ accountId: ACCOUNT });
    // 🚫 No organization is mentioned in either question. There is no parameter
    // through which one could be, and that is ADR-0082 D4 made unrepresentable
    // rather than merely forbidden.
    expect(JSON.stringify(recorded.accountWheres)).not.toContain('organizationId');
    expect(JSON.stringify(recorded.membershipWheres)).not.toContain('organizationId');
  });

  it('🚫 asks about the memberships of THAT account and no other', async () => {
    const { recorded, read } = readerOver(ACCOUNT_ROW, [MEMBERSHIP_ROW]);

    await read(ACCOUNT);

    expect(recorded.membershipWheres[0]).toEqual({ accountId: ACCOUNT });
  });

  it('🛑 reports an unknown account as absent, 🚫 never as an error naming it', async () => {
    const { read } = readerOver(null, []);

    const entry = await read('account-fictional-stranger');

    expect(entry.account).toBeUndefined();
    expect(entry.memberships).toEqual([]);
  });

  it('🚫 has no arm that takes an organization, an address, or nothing at all', () => {
    // ⚠️ A TYPE-LEVEL fact asserted at runtime: the read is unary. A second
    // parameter is how a tenant would arrive.
    expect(
      platformDirectoryReadByAccount(
        new PrismaPlatformAccountRunner({ $transaction: async () => undefined as never }),
      ).length,
    ).toBe(1);
  });
});
