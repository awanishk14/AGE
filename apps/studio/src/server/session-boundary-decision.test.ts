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
    ).toEqual({ kind: 'admitted', session: verified.principal.session });
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

  it('🛑 refuses a PLATFORM principal, and 🚫 never as a mismatch (ADR-0083 D1)', () => {
    // ⚠️ THE REASON MATTERS AS MUCH AS THE REFUSAL. Reporting this as
    // `organization-mismatch` would say a row belonged to the wrong tenant,
    // when in truth it belongs to none — and the operator would go looking for
    // a membership that is not supposed to exist.
    expect(
      decideSessionBoundary({
        lookupOrganizationId: ORG,
        presentedCookie: TOKEN,
        verification: verifiedPlatform,
      }),
    ).toEqual({ kind: 'refused', reason: 'platform-scope-not-yet-served' });
  });

  it('🚫 does not admit a platform principal by comparing an absent organization', () => {
    // 🛑 THE ONE-CHARACTER DANGEROUS ALTERNATIVE, REFUSED IN A TEST. If the
    // mismatch check were ever widened to treat "no organization" as "any
    // organization", THIS is the call that would start being admitted.
    const decision = decideSessionBoundary({
      lookupOrganizationId: ORG,
      presentedCookie: TOKEN,
      verification: verifiedPlatform,
    });

    expect(decision.kind).toBe('refused');
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
