import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { decideSignIn, type DirectoryEntry, type DirectoryMembership } from '../sign-in-decision';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/**
 * Every `.ts`/`.tsx` file under `apps/` and `packages/` whose text names
 * `needle`, as repo-relative paths.
 *
 * ⚠️ **`dist/`, `node_modules/` AND `.nx/` ARE SKIPPED, AND THAT IS A REAL
 * HOLE, NAMED.** Build output can hold a stale copy of a retired string, so a
 * scan that read it would fail on yesterday's artefact rather than on today's
 * source. What this asserts is that 🚫 no SOURCE names it.
 */
function sourcesNaming(needle: string): readonly string[] {
  const found: string[] = [];

  function walk(directory: string, relative: string): void {
    for (const entryName of readdirSync(directory, { withFileTypes: true })) {
      const name = entryName.name;

      if (name === 'node_modules' || name === 'dist' || name === '.nx' || name === '.next')
        continue;

      const path = join(directory, name);
      const shown = relative === '' ? name : `${relative}/${name}`;

      if (entryName.isDirectory()) {
        walk(path, shown);
        continue;
      }

      if (!name.endsWith('.ts') && !name.endsWith('.tsx')) continue;
      // 🚫 This file names the retired reason in order to forbid it.
      if (name === 'sign-in-decision.spec.ts') continue;

      if (readFileSync(path, 'utf8').includes(needle)) found.push(shown);
    }
  }

  walk(join(REPO_ROOT, 'apps'), 'apps');
  walk(join(REPO_ROOT, 'packages'), 'packages');

  return found.sort();
}

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

function platformMembership(overrides: Partial<DirectoryMembership> = {}): DirectoryMembership {
  return membership({
    membershipId: 'membership-fictional-platform',
    scopeKind: 'platform',
    organizationId: null,
    clientId: null,
    roleBundle: 'platform-admin',
    ...overrides,
  });
}

describe('🛑 a platform operator is admitted with 🚫 NO organization (ADR-0082 D1)', () => {
  it('carries `null`, and 🚫 not the organization it was asked about', () => {
    // 🛑 **THE ARGUMENT IS THE TRAP.** `ORGANIZATION` is passed in and must
    // reach 🚫 NOTHING on this path. A platform session filed under the pinned
    // tenant is the substitution ADR-0082 D4 forbids, and it would look exactly
    // like a working sign-in.
    expect(decideSignIn(entry({ memberships: [platformMembership()] }), ORGANIZATION)).toEqual({
      outcome: 'admitted',
      operator: {
        accountId: ACCOUNT_ID,
        organizationId: null,
        membershipId: 'membership-fictional-platform',
        roleBundle: 'platform-admin',
        scopeKind: 'platform',
        clientId: null,
      },
    });
  });

  it('🚫 grows no field the agency admission does not have', () => {
    // ⚠️ Asserted EXACTLY, so a platform-only field cannot arrive unnoticed —
    // a flag here is how "who is asking" becomes "what they may do".
    const decision = decideSignIn(entry({ memberships: [platformMembership()] }), ORGANIZATION);

    expect(Object.keys(decision.outcome === 'admitted' ? decision.operator : {}).sort()).toEqual([
      'accountId',
      'clientId',
      'membershipId',
      'organizationId',
      'roleBundle',
      'scopeKind',
    ]);
  });

  it('🚫 admits nobody whose platform membership was revoked', () => {
    expect(
      decideSignIn(
        entry({ memberships: [platformMembership({ revokedAt: '2026-08-18T08:00:00.000Z' })] }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'membership-revoked' });
  });

  it('🚫 admits nobody whose platform membership belongs to another account', () => {
    expect(
      decideSignIn(
        entry({
          memberships: [platformMembership({ accountId: 'account-fictional-someone-else' })],
        }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'no-membership' });
  });
});

describe('🛑 a platform membership that is not organization-less is REFUSED', () => {
  it('refuses one carrying an organization rather than ignoring it', () => {
    // 🛑 Such a row cannot come from the shipped read — its policy requires
    // `organization_id IS NULL`. If one arrives, the reader is not the one the
    // product thinks it is, and 🚫 believing half the row is how a platform
    // session acquires a tenant.
    expect(
      decideSignIn(
        entry({ memberships: [platformMembership({ organizationId: ORGANIZATION })] }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'incoherent-platform-membership' });
  });

  it('refuses one carrying a client', () => {
    expect(
      decideSignIn(
        entry({ memberships: [platformMembership({ clientId: 'client-fictional-1' })] }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'incoherent-platform-membership' });
  });
});

describe('🛑 platform NEVER outranks another live membership', () => {
  it('refuses a platform membership sitting beside an agency one', () => {
    // ⚠️ Precedence here would resolve silently, the same way every time, and
    // 🚫 in favour of the WIDEST scope AGE has.
    expect(
      decideSignIn(entry({ memberships: [platformMembership(), membership()] }), ORGANIZATION),
    ).toEqual({ outcome: 'refused', reason: 'ambiguous-membership' });
  });

  it('refuses two live platform memberships', () => {
    expect(
      decideSignIn(
        entry({
          memberships: [
            platformMembership(),
            platformMembership({ membershipId: 'membership-fictional-platform-2' }),
          ],
        }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'ambiguous-membership' });
  });

  it('⚠️ but a REVOKED agency membership beside it is not an ambiguity', () => {
    expect(
      decideSignIn(
        entry({
          memberships: [
            platformMembership(),
            membership({ revokedAt: '2026-08-18T08:00:00.000Z' }),
          ],
        }),
        ORGANIZATION,
      ),
    ).toMatchObject({ outcome: 'admitted', operator: { organizationId: null } });
  });
});

describe('🛑 the third tier comes through the door — ADR-0088', () => {
  it('ADMITS a client membership, carrying the client the ROW names', () => {
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
    ).toMatchObject({
      outcome: 'admitted',
      operator: {
        organizationId: ORGANIZATION,
        scopeKind: 'client',
        clientId: 'client-fictional-1',
      },
    });
  });

  it('🛑 refuses a client membership that names NO client, 🚫 rather than widening it', () => {
    // ⚠️ An absent client is 🚫 never "all clients" and 🚫 never the agency it
    // sits beneath. Refused HERE, so no session is ever issued against the row.
    expect(
      decideSignIn(
        entry({
          memberships: [
            membership({ scopeKind: 'client', clientId: null, roleBundle: 'client-viewer' }),
          ],
        }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'incoherent-client-membership' });
  });

  it('🛑 refuses an agency row and a client row TOGETHER, 🚫 never picking the wider one', () => {
    // 🛑 THE NARROWING NAMED IN ADR-0088 §3c. The agency row used to win
    // silently — harmless only while a client row could admit nobody.
    expect(
      decideSignIn(
        entry({
          memberships: [
            membership(),
            membership({
              membershipId: 'membership-fictional-2',
              scopeKind: 'client',
              clientId: 'client-fictional-1',
              roleBundle: 'client-viewer',
            }),
          ],
        }),
        ORGANIZATION,
      ),
    ).toEqual({ outcome: 'refused', reason: 'ambiguous-membership' });
  });

  it('🚫 no longer has a `client-scope-not-yet-served` reason to return', () => {
    // 🛑 **THE RETIRED REASON IS ASSERTED GONE, 🚫 SIMPLY DELETED** — the same
    // rule, and the same product-wide scan, as the retired reason below. A dead
    // refusal left in the union is a branch nobody can reach and a screen
    // nobody can see, and the next reader cannot tell it from a live one.
    expect(sourcesNaming('client-scope-not-yet-served')).toEqual([]);
  });

  it('🚫 no longer has a `platform-scope-not-yet-readable` reason to return', () => {
    // 🛑 **THE RETIRED REASON IS ASSERTED GONE, 🚫 NOT SIMPLY DELETED.** A dead
    // refusal reason left in the union is a branch that can never be reached
    // and a screen nobody can ever see, and the next reader cannot tell it from
    // a live one. ⚠️ Scanning the SOURCE rather than the type, because a type
    // that no longer names it compiles either way.
    //
    // ⚠️ **AND THE SCAN IS PRODUCT-WIDE, BECAUSE THE RULE IS.** The reason was
    // also switched on in the studio callback; a scan of this package alone
    // could not see that, and 🛑 A NARROW SCAN IS NOT A NARROW RULE — that one
    // pattern produced every audit gap this repository has found.
    expect(sourcesNaming('platform-scope-not-yet-readable')).toEqual([]);
  });

  it('⚠️ walked something — the scan above is not vacuously empty', () => {
    // 🛑 A walk that silently found no files would pass the assertion above
    // against a repository it never opened. The positive control names the file
    // that used to switch on the retired reason, so the scan is proven to
    // REACH the place the rule is about.
    const callers = sourcesNaming('decideSignIn');

    expect(callers).toContain('apps/studio/src/app/sign-in/callback/route.ts');
    expect(callers.length).toBeGreaterThan(2);
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

/**
 * **ADR-0089 §5.3 — `null` IS THE ABSENCE OF A TENANT CHANNEL, 🚫 NOT A
 * WILDCARD.**
 *
 * 🛑 **THE PLATFORM ARM OF `requireRequestScope` RE-READS ON EVERY REQUEST NOW,
 * AND IT HAS NO ORGANIZATION TO ASK ABOUT.** So it passes `null` — the absence
 * EXPRESSED rather than the pinned organization SUBSTITUTED (ADR-0082 D4). ⚠️
 * The danger the cases below pin down is the other direction: that `null` might
 * quietly mean *"any tenant"*, or that a malformed row with a NULL
 * `organization_id` might match it and be admitted as a tenant. 🚫 Neither.
 *
 * 🛑 **THE POSITIVE CASE IS 🚫 NOT DECORATION.** A decision that refused
 * everything when handed `null` would pass every refusal case here and lock
 * every platform operator out of the console on their next request.
 */
describe('🛑 `decideSignIn(entry, null)` — the request with no tenant channel', () => {
  it('admits a live PLATFORM membership, because that arm never read the parameter', () => {
    expect(decideSignIn(entry({ memberships: [platformMembership()] }), null)).toEqual({
      outcome: 'admitted',
      operator: {
        accountId: ACCOUNT_ID,
        organizationId: null,
        membershipId: 'membership-fictional-platform',
        roleBundle: 'platform-admin',
        scopeKind: 'platform',
        clientId: null,
      },
    });
  });

  it('🚫 REFUSES a live agency membership — `null` is 🚫 not "any organization"', () => {
    expect(decideSignIn(entry(), null)).toEqual({
      outcome: 'refused',
      reason: 'no-membership',
    });
  });

  it('🚫 REFUSES a live client membership too', () => {
    expect(
      decideSignIn(
        entry({
          memberships: [membership({ scopeKind: 'client', clientId: 'client-fictional-1' })],
        }),
        null,
      ),
    ).toEqual({ outcome: 'refused', reason: 'no-membership' });
  });

  it('🛑 REFUSES a malformed TENANT row whose organization is NULL — 🚫 absence does not match absence', () => {
    // 🛑 **THE ROW IS UNTRUSTED INPUT AND THIS IS THE BACK DOOR.** A plain
    // `membership.organizationId === organizationId` would have matched NULL to
    // NULL and admitted this row to a request that has no tenant at all —
    // ADR-0082 D4 undone by an equality test rather than by a `??`.
    expect(
      decideSignIn(entry({ memberships: [membership({ organizationId: null })] }), null),
    ).toEqual({ outcome: 'refused', reason: 'no-membership' });
  });

  it('🚫 a REVOKED platform membership is refused, which is the whole reason the re-read exists', () => {
    expect(
      decideSignIn(
        entry({ memberships: [platformMembership({ revokedAt: '2026-08-21T00:00:00.000Z' })] }),
        null,
      ),
    ).toEqual({ outcome: 'refused', reason: 'membership-revoked' });
  });
});
