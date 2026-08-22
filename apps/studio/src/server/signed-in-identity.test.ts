import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **THE SIGNED-IN LABEL** — who the console says you are, in the rail.
 *
 * 🛑 **THE POINT OF THESE CASES IS THAT IT IS A LABEL AND NOTHING ELSE.** It
 * must never redirect (the root layout is 🚫 not a boundary — ADR-0074 §7 slice
 * 2, and a layout that redirected would also redirect `/sign-in`), it must
 * never throw out of the layout, and it must never turn an absent organization
 * into a present one (ADR-0082 D4).
 *
 * ⚠️ Every address below is obviously fictional — `.invalid` is reserved and
 * can never resolve (ADR-0053 D3, ADR-0065 D1). 🚫 No real operator address
 * appears in this repository.
 */

const readDirectoryEntryByAccount = vi.fn();
const readPlatformDirectoryEntryByAccount = vi.fn();

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});

vi.mock('next/navigation', () => ({
  redirect: (to: string) => redirect(to),
}));

vi.mock('./operator-environment', () => ({
  readDirectoryEntryByAccount: (organizationId: string, accountId: string) =>
    readDirectoryEntryByAccount(organizationId, accountId),
  readPlatformDirectoryEntryByAccount: (accountId: string) =>
    readPlatformDirectoryEntryByAccount(accountId),
}));

const entryFor = (accountId: string, email: string) => ({
  account: { accountId, email, disabledAt: null },
  memberships: [],
});

const tenantPrincipal = {
  scope: 'tenant' as const,
  session: {
    sessionId: 'session-fictional-tenant',
    organizationId: 'org-fictional-nowhere',
    accountId: 'account-fictional-agency',
  },
};

const platformPrincipal = {
  scope: 'platform' as const,
  session: {
    sessionId: 'session-fictional-platform',
    accountId: 'account-fictional-platform',
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const call = async (principal: unknown) => {
  const { signedInIdentity } = await import('./signed-in-identity');
  return signedInIdentity(principal as any);
};
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('signedInIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readDirectoryEntryByAccount.mockResolvedValue(
      entryFor('account-fictional-agency', 'agency@fictional.invalid'),
    );
    readPlatformDirectoryEntryByAccount.mockResolvedValue(
      entryFor('account-fictional-platform', 'platform@fictional.invalid'),
    );
  });

  it('reads a tenant principal WITHIN its organization, keyed by the account the session proved', async () => {
    await expect(call(tenantPrincipal)).resolves.toEqual({ email: 'agency@fictional.invalid' });

    expect(readDirectoryEntryByAccount).toHaveBeenCalledWith(
      'org-fictional-nowhere',
      'account-fictional-agency',
    );
    expect(readPlatformDirectoryEntryByAccount).not.toHaveBeenCalled();
  });

  it('reads a platform principal by ACCOUNT ALONE, and never substitutes an organization', async () => {
    await expect(call(platformPrincipal)).resolves.toEqual({ email: 'platform@fictional.invalid' });

    expect(readPlatformDirectoryEntryByAccount).toHaveBeenCalledWith('account-fictional-platform');
    // 🛑 ADR-0082 D4. A platform principal looked up inside the pinned tenant is
    // the coalescing this whole union exists to make unrepresentable.
    expect(readDirectoryEntryByAccount).not.toHaveBeenCalled();
  });

  it('reports nothing rather than redirecting when the directory holds no account', async () => {
    readPlatformDirectoryEntryByAccount.mockResolvedValue({ account: undefined, memberships: [] });

    await expect(call(platformPrincipal)).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('reports nothing rather than throwing when the directory read fails', async () => {
    readDirectoryEntryByAccount.mockRejectedValue(new Error('store unreachable'));

    await expect(call(tenantPrincipal)).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('treats a blank address as no address, never as an empty label', async () => {
    readDirectoryEntryByAccount.mockResolvedValue(entryFor('account-fictional-agency', '   '));

    await expect(call(tenantPrincipal)).resolves.toBeUndefined();
  });
});
