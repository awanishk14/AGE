import { describe, expect, it } from 'vitest';

import {
  decideSignIn,
  decideSignInAcrossDirectories,
  type DirectoryEntry,
  type DirectoryMembership,
} from '../index';

/**
 * ADR-0083 slice C4b — **the two directory channels, decided together.**
 *
 * 🛑 **WHAT THESE PROVE.** That a platform operator is admitted with 🚫 no
 * organization; that being provisioned in BOTH channels is refused as an
 * ambiguity rather than resolved by a precedence; that a row arriving through
 * the wrong channel is refused rather than believed; and that the tenant answer
 * is 🚫 not disturbed when the platform channel knows nobody — asserted by
 * comparing against `decideSignIn` itself rather than by restating it.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const ORGANIZATION = 'organization-fictional-alpha';

const NOBODY: DirectoryEntry = { account: undefined, memberships: [] };

const account = (accountId: string) => ({
  accountId,
  email: 'operator@example.invalid',
  disabledAt: null,
});

const membership = (overrides: Partial<DirectoryMembership> = {}): DirectoryMembership => ({
  membershipId: 'membership-fictional-1',
  accountId: 'account-fictional-1',
  scopeKind: 'agency',
  organizationId: ORGANIZATION,
  clientId: null,
  roleBundle: 'agency-operator',
  revokedAt: null,
  ...overrides,
});

const TENANT: DirectoryEntry = {
  account: account('account-fictional-1'),
  memberships: [membership()],
};

const PLATFORM: DirectoryEntry = {
  account: account('account-fictional-1'),
  memberships: [
    membership({
      membershipId: 'membership-fictional-platform',
      scopeKind: 'platform',
      organizationId: null,
      roleBundle: 'platform-admin',
    }),
  ],
};

describe('decideSignInAcrossDirectories', () => {
  it('🛑 admits a platform operator with 🚫 NO organization', () => {
    const decision = decideSignInAcrossDirectories(NOBODY, PLATFORM, ORGANIZATION);

    expect(decision.outcome).toBe('admitted');
    if (decision.outcome !== 'admitted') return;

    // 🛑 `null`, and 🚫 NOT the pinned organization — ADR-0082 D4.
    expect(decision.operator.organizationId).toBeNull();
    expect(decision.operator.scopeKind).toBe('platform');
    expect(JSON.stringify(decision)).not.toContain(ORGANIZATION);
  });

  it('⚠️ leaves the tenant answer BYTE-IDENTICAL when nobody is on the platform channel', () => {
    // 🛑 COMPARED AGAINST THE SHIPPED DECISION, 🚫 not against a restatement of
    // it here. A copy of the expected shape would keep passing while the two
    // drifted apart.
    expect(decideSignInAcrossDirectories(TENANT, NOBODY, ORGANIZATION)).toEqual(
      decideSignIn(TENANT, ORGANIZATION),
    );
  });

  it('🛑 refuses when BOTH channels admit — an ambiguity, 🚫 not a precedence', () => {
    const decision = decideSignInAcrossDirectories(TENANT, PLATFORM, ORGANIZATION);

    expect(decision).toEqual({ outcome: 'refused', reason: 'ambiguous-membership' });
  });

  it('🛑 refuses a platform row that came back through the TENANT channel', () => {
    expect(decideSignInAcrossDirectories(PLATFORM, NOBODY, ORGANIZATION)).toEqual({
      outcome: 'refused',
      reason: 'crossed-directory-channel',
    });
  });

  it('🛑 refuses a tenant row that came back through the PLATFORM channel', () => {
    expect(decideSignInAcrossDirectories(NOBODY, TENANT, ORGANIZATION)).toEqual({
      outcome: 'refused',
      reason: 'crossed-directory-channel',
    });
  });

  it('⚠️ reports the OTHER channel’s reason when one channel simply has no account', () => {
    // ⚠️ `no-account` is the absence of a channel, 🚫 not a finding about the
    // person: a platform operator is simply not in the tenant directory. The
    // reason a host operator can act on is the other one.
    const revoked: DirectoryEntry = {
      account: PLATFORM.account,
      memberships: PLATFORM.memberships.map((entry) => ({
        ...entry,
        revokedAt: '2026-08-01T00:00:00.000Z',
      })),
    };

    expect(decideSignInAcrossDirectories(NOBODY, revoked, ORGANIZATION)).toEqual({
      outcome: 'refused',
      reason: 'membership-revoked',
    });
  });

  it('⚠️ keeps the tenant reason when the tenant channel is the one that found somebody', () => {
    const disabled: DirectoryEntry = {
      account: { ...account('account-fictional-1'), disabledAt: '2026-08-01T00:00:00.000Z' },
      memberships: [membership()],
    };

    expect(decideSignInAcrossDirectories(disabled, NOBODY, ORGANIZATION)).toEqual({
      outcome: 'refused',
      reason: 'account-disabled',
    });
  });

  it('🚫 admits nobody when neither channel knows the address', () => {
    expect(decideSignInAcrossDirectories(NOBODY, NOBODY, ORGANIZATION)).toEqual({
      outcome: 'refused',
      reason: 'no-account',
    });
  });

  it('🛑 the organization is 🚫 never read into the platform admission, by any spelling', () => {
    // ⚠️ A different pinned organization must change 🚫 nothing about a platform
    // admission — if it does, the tenant argument has leaked into the arm that
    // must not have one.
    expect(decideSignInAcrossDirectories(NOBODY, PLATFORM, 'organization-fictional-omega')).toEqual(
      decideSignInAcrossDirectories(NOBODY, PLATFORM, ORGANIZATION),
    );
  });
});
