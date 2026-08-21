import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **THE AGENCY RENDERING GATE** — ADR-0088 §5.
 *
 * 🛑 **THIS IS THE GUARD THAT MADE LIFTING THE SIGN-IN REFUSAL SAFE.** Until
 * 2026-08-21 all fifteen agency pages gated on `requireVerifiedSession` alone,
 * which proves a session and 🚫 cannot tell a client from an agency operator.
 * Admitting a client without this would have handed them
 * `readBusinessesView(organizationId)` — **every business the agency manages** —
 * and `/b/<any-sibling-client>/…` besides.
 *
 * ⚠️ **THE POSITIVE CASES ARE 🚫 NOT DECORATION.** A gate that refused everyone
 * would pass the client case below and break the console; both the agency
 * operator and the ADR-0085 platform operator are asserted to still render.
 */

const assessRequestSession = vi.fn();
const requireVerifiedSession = vi.fn();
const readDirectoryEntryByAccount = vi.fn();

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});

vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
  redirect: (to: string) => redirect(to),
}));

vi.mock('./session-boundary', () => ({
  assessRequestSession: () => assessRequestSession(),
  requireVerifiedSession: () => requireVerifiedSession(),
}));

vi.mock('./operator-environment', () => ({
  readDirectoryEntryByAccount: (organizationId: string, accountId: string) =>
    readDirectoryEntryByAccount(organizationId, accountId),
}));

const { requireAgencyRendering } = await import('./request-scope');

const ORGANIZATION = 'org-fictional-alpha';
const ACCOUNT = 'account-fictional-operator';

const tenantSession = {
  sessionId: 'session-fictional-1',
  organizationId: ORGANIZATION,
  accountId: ACCOUNT,
};

function entry(membership: Record<string, unknown>) {
  return {
    account: { accountId: ACCOUNT, email: 'operator@fictional.invalid', disabledAt: null },
    memberships: [
      {
        membershipId: 'membership-fictional-1',
        accountId: ACCOUNT,
        organizationId: ORGANIZATION,
        revokedAt: null,
        ...membership,
      },
    ],
  };
}

const AGENCY_MEMBERSHIP = { scopeKind: 'agency', roleBundle: 'agency-operator', clientId: null };
const CLIENT_MEMBERSHIP = {
  scopeKind: 'client',
  roleBundle: 'client-viewer',
  clientId: 'client-fictional-kite-repairs',
};

beforeEach(() => {
  assessRequestSession.mockReset();
  requireVerifiedSession.mockReset();
  readDirectoryEntryByAccount.mockReset();
  notFound.mockClear();
  redirect.mockClear();

  // ⚠️ A VALID SESSION IN EVERY CASE, INCLUDING THE REDIRECTED ONE. The client
  // below is 🚫 not being refused — they are signed in and provisioned, and are
  // being sent where they live.
  requireVerifiedSession.mockResolvedValue(tenantSession);
  assessRequestSession.mockResolvedValue({
    kind: 'admitted',
    principal: { scope: 'tenant', session: tenantSession },
  });
});

describe('an agency operator', () => {
  it('renders, and gets the session the boundary proved', async () => {
    readDirectoryEntryByAccount.mockResolvedValue(entry(AGENCY_MEMBERSHIP));

    await expect(requireAgencyRendering()).resolves.toBe(tenantSession);

    expect(redirect).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe('a PLATFORM operator who has already chosen an organization', () => {
  /**
   * 🛑 **ADR-0085 MUST NOT BREAK.** `requireVerifiedSession` resolves the acting
   * organization for this principal and hands back an ordinary tenant session;
   * `requireRequestScope` reports `platformScope()`, which is 🚫 not a client
   * scope. ⚠️ And 🚫 no directory read happens on that arm — passing the pinned
   * organization to "make the re-read work" is the ADR-0082 D4 substitution.
   */
  it('still renders the agency pages', async () => {
    assessRequestSession.mockResolvedValue({
      kind: 'admitted',
      principal: { scope: 'platform', session: { sessionId: 'session-fictional-2' } },
    });

    await expect(requireAgencyRendering()).resolves.toBe(tenantSession);

    expect(redirect).not.toHaveBeenCalled();
    expect(readDirectoryEntryByAccount).not.toHaveBeenCalled();
  });
});

describe('a CLIENT who lands on an agency page', () => {
  it('is sent to `/client`, 🚫 and never reaches the page body', async () => {
    readDirectoryEntryByAccount.mockResolvedValue(entry(CLIENT_MEMBERSHIP));

    // 🛑 IT THROWS, so the read below the call site is unreachable. 🚫 There is
    // no falsy return a page could forget to check.
    await expect(requireAgencyRendering()).rejects.toThrow('NEXT_REDIRECT:/client');
  });

  it('is REDIRECTED and 🚫 NOT refused — the difference is the decision', async () => {
    readDirectoryEntryByAccount.mockResolvedValue(entry(CLIENT_MEMBERSHIP));

    await expect(requireAgencyRendering()).rejects.toThrow();

    // ⚠️ A 404 here would be the ADR-0084 defect in a third costume: a working
    // session rendered as a failed one. The opaque 404 is for a screen that is
    // NOT THEIRS; `/` is simply not where they live.
    expect(notFound).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/client');
  });
});
