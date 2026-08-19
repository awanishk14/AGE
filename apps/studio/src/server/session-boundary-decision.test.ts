import { describe, expect, it } from 'vitest';

import { decideSessionBoundary } from './session-boundary-decision';

/**
 * ⚠️ WHAT THESE PROVE: that the boundary admits ONLY a verified row whose
 * organization matches the deployment's, that every refusal keeps its own
 * reason, and — the one that matters most — that the ORDER holds, so a console
 * with no configured organization never implies that a credential was wrong.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const ORG = 'org-fictional-1';
const TOKEN = 'a'.repeat(64);

const verified = {
  outcome: 'verified',
  principal: {
    scope: 'tenant',
    session: {
      sessionId: 'session-fictional-1',
      organizationId: ORG,
      accountId: 'acct-fictional-1',
    },
  },
} as const;

/**
 * 🛑 A PLATFORM PRINCIPAL — ADR-0083 D1. It has 🚫 no `organizationId`, and
 * that is the point: the mismatch check below cannot be written over it.
 */
const verifiedPlatform = {
  outcome: 'verified',
  principal: {
    scope: 'platform',
    session: { sessionId: 'session-fictional-2', accountId: 'acct-fictional-2' },
  },
} as const;

describe('decideSessionBoundary', () => {
  it('admits a verified session in this deployment’s organization', () => {
    expect(
      decideSessionBoundary({
        lookupOrganizationId: ORG,
        presentedCookie: TOKEN,
        verification: verified,
      }),
    ).toEqual({ kind: 'admitted', principal: verified.principal });
  });

  it('🛑 refuses a console that was never told which organization it serves', () => {
    // ⚠️ AND IT REFUSES BEFORE LOOKING AT THE COOKIE. A misconfigured host must
    // not be able to say "that token was not accepted" about a good token.
    expect(
      decideSessionBoundary({
        lookupOrganizationId: undefined,
        presentedCookie: TOKEN,
        verification: verified,
      }),
    ).toEqual({ kind: 'refused', reason: 'deployment-not-configured' });
  });

  it('🚫 an absent cookie is an ordinary anonymous request, not a bad credential', () => {
    expect(
      decideSessionBoundary({
        lookupOrganizationId: ORG,
        presentedCookie: undefined,
        verification: undefined,
      }),
    ).toEqual({ kind: 'refused', reason: 'no-cookie' });
  });

  it.each(['malformed-token', 'no-such-session', 'revoked', 'expired', 'unreadable'] as const)(
    '🚫 keeps `%s` as its own reason — the five are not collapsed here',
    (reason) => {
      expect(
        decideSessionBoundary({
          lookupOrganizationId: ORG,
          presentedCookie: TOKEN,
          verification: { outcome: 'unverified', reason },
        }),
      ).toEqual({ kind: 'refused', reason });
    },
  );

  it('🛑 refuses a verified row belonging to another organization', () => {
    // Under RLS this should be unreachable, which is exactly why it is checked.
    // 🚫 A boundary that only handles the cases it believes possible fails open
    // the day one of them turns out to be possible.
    expect(
      decideSessionBoundary({
        lookupOrganizationId: 'org-fictional-2',
        presentedCookie: TOKEN,
        verification: verified,
      }),
    ).toEqual({ kind: 'refused', reason: 'organization-mismatch' });
  });

  it('🛑 admits a PLATFORM principal AS a platform principal (ADR-0083 D1)', () => {
    // ⚠️ **ADMITTED SAYS WHO, AND 🚫 STILL NOTHING ABOUT REACH.** What it
    // must 🚫 never do is arrive wearing a tenant's clothes: the principal is
    // handed back whole, so the caller has to narrow before it can read an
    // organization — and on this arm there is none to read.
    expect(
      decideSessionBoundary({
        lookupOrganizationId: ORG,
        presentedCookie: TOKEN,
        verification: verifiedPlatform,
      }),
    ).toEqual({ kind: 'admitted', principal: verifiedPlatform.principal });
  });

  it('🚫 admits a platform principal WITHOUT giving it an organization', () => {
    // 🛑 THE ONE-CHARACTER DANGEROUS ALTERNATIVE, REFUSED IN A TEST. If the
    // mismatch check were ever widened to treat "no organization" as "any
    // organization" — or if the pinned one were quietly copied onto this
    // principal — THIS is the assertion that would start failing.
    const decision = decideSessionBoundary({
      lookupOrganizationId: ORG,
      presentedCookie: TOKEN,
      verification: verifiedPlatform,
    });

    expect(decision.kind).toBe('admitted');
    if (decision.kind !== 'admitted') return;
    expect(decision.principal.scope).toBe('platform');
    expect(JSON.stringify(decision.principal)).not.toContain(ORG);
    expect('organizationId' in decision.principal.session).toBe(false);
  });

  it('🛑 a TENANT principal in the wrong organization is STILL a mismatch', () => {
    // ⚠️ The organization check was NARROWED to the tenant arm, 🚫 not deleted.
    // This is the case that proves the narrowing did not take the rule with it.
    expect(
      decideSessionBoundary({
        lookupOrganizationId: 'org-fictional-9',
        presentedCookie: TOKEN,
        verification: verified,
      }),
    ).toEqual({ kind: 'refused', reason: 'organization-mismatch' });
  });

  it('🚫 a missing verdict is never an admission', () => {
    expect(
      decideSessionBoundary({
        lookupOrganizationId: ORG,
        presentedCookie: TOKEN,
        verification: undefined,
      }),
    ).toEqual({ kind: 'refused', reason: 'unreadable' });
  });
});
