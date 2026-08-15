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
  session: { sessionId: 'session-fictional-1', organizationId: ORG, accountId: 'acct-fictional-1' },
} as const;

describe('decideSessionBoundary', () => {
  it('admits a verified session in this deployment’s organization', () => {
    expect(
      decideSessionBoundary({
        lookupOrganizationId: ORG,
        presentedCookie: TOKEN,
        verification: verified,
      }),
    ).toEqual({ kind: 'admitted', session: verified.session });
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
