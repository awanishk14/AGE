import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **THE CLIENT RENDERING GATE** — ADR-0087 §5.
 *
 * 🛑 **EVERY REFUSAL BELOW IS PROVEN BY A THROW, 🚫 NEVER BY AN EMPTY RESULT.**
 * `requireClientRendering` either returns the one client this request may see or
 * does not return at all; a boundary that returned something falsy would be a
 * boundary a caller could forget to check.
 *
 * 🛑 **THE SESSION IS VALID IN EVERY CASE, INCLUDING THE REFUSED ONES.** What
 * differs is the MEMBERSHIP the store hands back on this request. A test that
 * refused an expired session would prove only that ADR-0074 still works, which
 * was never in doubt.
 *
 * ⚠️ **THE WIDER SCOPES ARE REFUSED TOO, AND THAT IS THE POINT.** An agency
 * operator can see more than this screen shows and is still turned away: the
 * gate asks "is this a CLIENT?", 🚫 not "is this enough?".
 */

const assessRequestSession = vi.fn();
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
}));

vi.mock('./operator-environment', () => ({
  readDirectoryEntryByAccount: (organizationId: string, accountId: string) =>
    readDirectoryEntryByAccount(organizationId, accountId),
}));

const { requireClientRendering } = await import('./request-scope');

const ORGANIZATION = 'org-fictional-alpha';
const ACCOUNT = 'account-fictional-viewer';
const CLIENT = 'client-fictional-kite-repairs';

const tenantSession = {
  sessionId: 'session-fictional-1',
  organizationId: ORGANIZATION,
  accountId: ACCOUNT,
};

function entry(membership: Record<string, unknown>) {
  return {
    account: { accountId: ACCOUNT, email: 'viewer@fictional.invalid', disabledAt: null },
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

const CLIENT_MEMBERSHIP = {
  scopeKind: 'client',
  roleBundle: 'client-viewer',
  clientId: CLIENT,
};

const AGENCY_MEMBERSHIP = {
  scopeKind: 'agency',
  roleBundle: 'agency-operator',
  clientId: null,
};

beforeEach(() => {
  assessRequestSession.mockReset();
  readDirectoryEntryByAccount.mockReset();
  notFound.mockClear();
  redirect.mockClear();

  assessRequestSession.mockResolvedValue({
    kind: 'admitted',
    principal: { scope: 'tenant', session: tenantSession },
  });
});

describe('a client membership, on this slice', () => {
  /**
   * 🛑 **IT IS STILL REFUSED AT ADMISSION, AND THIS TEST SAYS SO OUT LOUD**
   * (ADR-0087 §6). `decideSignIn` answers `client-scope-not-yet-served`, and
   * `requireRequestScope` turns that into the same door every refused operator
   * sees. So `/client` is 🚫 **UNREACHABLE BY ANY REAL CALLER** as this slice
   * merges, and 🚫 must not be reported as browser-proven. Lifting that refusal
   * is slice 2, and this test is what will fail loudly when it is lifted —
   * ⚠️ deliberately, so the change cannot be made silently.
   */
  it('cannot reach the screen yet, and is sent to the door 🚫 without a reason it could act on', async () => {
    readDirectoryEntryByAccount.mockResolvedValue(entry(CLIENT_MEMBERSHIP));

    await expect(requireClientRendering()).rejects.toThrow(
      'NEXT_REDIRECT:/sign-in?refused=not-provisioned',
    );
  });
});

describe('the scopes this screen is not for', () => {
  it('refuses an AGENCY operator, who can see MORE and is still turned away', async () => {
    readDirectoryEntryByAccount.mockResolvedValue(entry(AGENCY_MEMBERSHIP));

    await expect(requireClientRendering()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();

    // 🛑 PROOF THE WIRE IS LIVE: it read the directory, was ADMITTED, and was
    // refused by the client check rather than by the door.
    expect(readDirectoryEntryByAccount).toHaveBeenCalledWith(ORGANIZATION, ACCOUNT);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('refuses a PLATFORM principal with the same opaque 404, 🚫 not a redirect', async () => {
    assessRequestSession.mockResolvedValue({
      kind: 'admitted',
      principal: { scope: 'platform', session: { sessionId: 'session-fictional-2' } },
    });

    await expect(requireClientRendering()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();

    // 🛑 A REDIRECT TO `/platform` WOULD TELL THE CALLER THIS ROUTE EXISTS AND
    // THAT THEY ARE SOMEBODY. Absence and denial must be indistinguishable.
    expect(redirect).not.toHaveBeenCalled();

    // ⚠️ And it never touched the directory: there is no organization to scope
    // that read by, and passing the pinned one is the ADR-0082 D4 substitution.
    expect(readDirectoryEntryByAccount).not.toHaveBeenCalled();
  });
});

/**
 * 🛑 **THE "ANOTHER CLIENT'S SUBJECT" CASE IS 🚫 NOT WRITTEN HERE, AND THAT IS
 * THE GUARD WORKING RATHER THAN BEING AVOIDED.** Reaching for `decideAccess` in
 * this file broke the single-importer guard in `@age/access-scope`
 * (`guards.spec.ts`: *"is imported by the one composed boundary and nothing
 * else"*), which exists so a scope decision cannot be asked slightly differently
 * from a second place. ⚠️ The rule was NARROWED to where it belongs rather than
 * the guard widened to admit a test: `scope-model.spec.ts` already proves a
 * client scope *"grants only its own agency and its own client, for every atom
 * and every subject"*, and `requireClientRendering` takes its subject from that
 * same scope.
 */
