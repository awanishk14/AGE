import { describe, expect, it } from 'vitest';

import { decideSignIn, type DirectoryEntry, type DirectoryMembership } from '../sign-in-decision';

/**
 * ADR-0079 slice 3 — **who a provisioned row admits, and who it does not.**
 *
 * ⚠️ Every fixture is obviously fictional. 🚫 No real operator, organization or
 * address appears here — obvious fictionality IS the guard.
 */

const ORGANIZATION = 'organization-fictional-alpha';
const ACCOUNT_ID = 'account-fictional-operator';

const ACCOUNT = Object.freeze({
  accountId: ACCOUNT_ID,
  email: 'operator@example.invalid',
  disabledAt: null,
});

function membership(overrides: Partial<DirectoryMembership> = {}): DirectoryMembership {
  return Object.freeze({
    membershipId: 'membership-fictional-1',
    accountId: ACCOUNT_ID,
    scopeKind: 'agency',
    organizationId: ORGANIZATION,
    clientId: null,
    roleBundle: 'agency-operator',
    revokedAt: null,
    ...overrides,
  });
}

function entry(overrides: Partial<DirectoryEntry> = {}): DirectoryEntry {
  return Object.freeze({ account: ACCOUNT, memberships: [membership()], ...overrides });
}

describe('a provisioned agency operator is admitted', () => {
  it('names the account, the organization and the membership that admitted them', () => {
    expect(decideSignIn(entry(), ORGANIZATION)).toEqual({
      outcome: 'admitted',
      operator: {
        accountId: ACCOUNT_ID,
        organizationId: ORGANIZATION,
        membershipId: 'membership-fictional-1',
        roleBundle: 'agency-operator',
        scopeKind: 'agency',
        clientId: null,
      },
    });
  });

  it('🚫 carries no capability, no permission and no `isAdmin`', () => {
    const decision = decideSignIn(entry(), ORGANIZATION);

    // 🛑 ADR-0062 D3. A session says who is asking; what that means is read per
    // request. If this ever grew a permission list, admin would become a flag.
    //
    // ⚠️ **SLICE 4 ADDED TWO FIELDS, AND THEY ARE THE ROW'S WORDS — 🚫 NOT A
    // CONCLUSION.** `scopeKind` and `clientId` are copied off the membership so
    // `scopeForMembership` can turn them into a scope in its own pure package;
    // neither is a capability, a permission or a flag, and this list is asserted
    // EXACTLY so a third field cannot arrive unnoticed.
    expect(decision.outcome).toBe('admitted');
    expect(Object.keys(decision.outcome === 'admitted' ? decision.operator : {}).sort()).toEqual([
      'accountId',
      'clientId',
      'membershipId',
      'organizationId',
      'roleBundle',
      'scopeKind',
    ]);
  });
});

describe('🛑 AGE mints nothing — an identity without a row is refused', () => {
  it('refuses a verified identity with no account', () => {
    expect(decideSignIn(entry({ account: undefined }), ORGANIZATION)).toEqual({
      outcome: 'refused',
      reason: 'no-account',
    });
  });

  it('refuses a disabled account', () => {
    expect(
      decideSignIn(
        entry({ account: { ...ACCOUNT, disabledAt: '2026-08-18T09:00:00.000Z' } }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'account-disabled' });
  });

  it('refuses an account with no membership at all', () => {
    expect(decideSignIn(entry({ memberships: [] }), ORGANIZATION)).toEqual({
      outcome: 'refused',
      reason: 'no-membership',
    });
  });

  it('⚠️ distinguishes a REVOKED membership from one that never existed', () => {
    // 🛑 The two are the same screen and completely different problems. A
    // reason that collapsed them would hide a revocation that did not take.
    expect(
      decideSignIn(
        entry({ memberships: [membership({ revokedAt: '2026-08-18T08:00:00.000Z' })] }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'membership-revoked' });
  });

  it('🚫 never admits on a membership belonging to another account', () => {
    expect(
      decideSignIn(
        entry({ memberships: [membership({ accountId: 'account-fictional-somebody-else' })] }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'no-membership' });
  });

  it('🛑 never admits on a membership belonging to another organization', () => {
    expect(
      decideSignIn(
        entry({ memberships: [membership({ organizationId: 'organization-fictional-beta' })] }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'no-membership' });
  });
});

describe('🛑 the scopes slice 3 deliberately does not serve are refused BY NAME', () => {
  it('refuses a client membership rather than showing them agency screens', () => {
    expect(
      decideSignIn(
        entry({
          memberships: [
            membership({
              scopeKind: 'client',
              clientId: 'client-fictional-1',
              roleBundle: 'client-viewer',
            }),
          ],
        }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'client-scope-not-yet-served' });
  });

  it('refuses a platform membership, which no scoped read can even return', () => {
    // 🛑 `organization_id IS NULL` never equals the scope, so slice 2's policy
    // makes these invisible to `age_app`. The refusal is here so the gap is
    // NAMED rather than appearing as a mysterious "no membership".
    expect(
      decideSignIn(
        entry({
          memberships: [
            membership({
              scopeKind: 'platform',
              organizationId: null,
              roleBundle: 'platform-admin',
            }),
          ],
        }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'platform-scope-not-yet-readable' });
  });
});

describe('🛑 two live memberships are refused, never chosen between', () => {
  it('refuses rather than picking a role bundle for somebody', () => {
    expect(
      decideSignIn(
        entry({
          memberships: [
            membership({ membershipId: 'membership-fictional-1', roleBundle: 'agency-operator' }),
            membership({ membershipId: 'membership-fictional-2', roleBundle: 'agency-owner' }),
          ],
        }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'ambiguous-membership' });
  });

  it('⚠️ but a revoked second membership is not an ambiguity', () => {
    expect(
      decideSignIn(
        entry({
          memberships: [
            membership({ membershipId: 'membership-fictional-1' }),
            membership({
              membershipId: 'membership-fictional-2',
              roleBundle: 'agency-owner',
              revokedAt: '2026-08-18T08:00:00.000Z',
            }),
          ],
        }),
        ORGANIZATION,
      ),
    ).toMatchObject({ outcome: 'admitted' });
  });
});
