import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **THE MEMBERSHIP A PLATFORM OPERATOR NO LONGER KEEPS UNTIL EXPIRY** —
 * ADR-0089 §7.
 *
 * 🛑 **THIS IS THE CASE THAT DID NOT EXIST BEFORE.** ADR-0079 §2 property 2 says
 * the scope is read from the database on EVERY request, 🚫 never from a token
 * claim — so a revoked operator loses their reach on the NEXT request rather
 * than at expiry. That was true on the tenant arm and FALSE on the platform arm,
 * and the falsity was on the WIDEST scope AGE has, for up to eight hours.
 *
 * 🛑 **THE POSITIVE CASE IS 🚫 NOT DECORATION.** A gate that refused every
 * platform principal would pass the revocation case below and lock the only
 * provisioned operator out of the console. Both directions are asserted.
 *
 * 🛑 **NO CASE HERE ASSERTS AN EMPTY RESULT AS PROOF.** Each asserts what was
 * ASKED — the account id the SESSION proved, and 🚫 no organization alongside it.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const PLATFORM_ACCOUNT = 'account-fictional-platform-1';
const PLATFORM_SESSION = 'session-fictional-platform-1';
const PINNED_ORGANIZATION = 'org-fictional-alpha';

interface FixtureEntry {
  readonly account:
    | { readonly accountId: string; readonly email: string; readonly disabledAt: string | null }
    | undefined;
  readonly memberships: readonly {
    readonly membershipId: string;
    readonly accountId: string;
    readonly scopeKind: string;
    readonly organizationId: string | null;
    readonly clientId: string | null;
    readonly roleBundle: string;
    readonly revokedAt: string | null;
  }[];
}

function platformEntry(revokedAt: string | null): FixtureEntry {
  return {
    account: {
      accountId: PLATFORM_ACCOUNT,
      email: 'platform@example.invalid',
      disabledAt: null,
    },
    memberships: [
      {
        membershipId: 'membership-fictional-platform',
        accountId: PLATFORM_ACCOUNT,
        scopeKind: 'platform',
        organizationId: null,
        clientId: null,
        roleBundle: 'platform-admin',
        revokedAt,
      },
    ],
  };
}

const assessRequestSession = vi.fn();
const readDirectoryEntryByAccount = vi.fn();
const readPlatformDirectoryEntryByAccount = vi.fn(
  async (_accountId: string): Promise<FixtureEntry> => platformEntry(null),
);

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
  redirect: (to: string) => redirect(to),
}));

vi.mock('./operator-environment', () => ({
  readDirectoryEntryByAccount: (organizationId: string, accountId: string) =>
    readDirectoryEntryByAccount(organizationId, accountId),
  // 🛑 **EVERY ARGUMENT IS FORWARDED, 🚫 NOT JUST THE ONE EXPECTED.** A factory
  // written `(accountId) => spy(accountId)` would SWALLOW a second argument, and
  // the arity guard below — the one asserting that 🚫 no organization is passed —
  // would stay green while the code passed the pinned organization. ⚠️ A guard
  // scoped narrower than its rule is how all three of this repo's audit gaps
  // arrived; this one is scoped to the rule.
  readPlatformDirectoryEntryByAccount: (...args: readonly unknown[]) =>
    readPlatformDirectoryEntryByAccount(...(args as [string])),
  sessionLookupOrganizationId: () => PINNED_ORGANIZATION,
  organizationsThisConsoleServes: () => [{ id: PINNED_ORGANIZATION, displayName: 'org-alpha' }],
}));

// ⚠️ The scope module is exercised against a MOCKED boundary: what is under test
// is the branch it takes on an ALREADY VERIFIED principal — 🚫 not how that
// principal was verified.
vi.mock('./session-boundary', () => ({
  assessRequestSession: () => assessRequestSession(),
}));

const { requireRequestScope } = await import('./request-scope');

const admittedPlatform = {
  kind: 'admitted' as const,
  principal: {
    scope: 'platform' as const,
    session: { sessionId: PLATFORM_SESSION, accountId: PLATFORM_ACCOUNT },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  readPlatformDirectoryEntryByAccount.mockResolvedValue(platformEntry(null));
  assessRequestSession.mockResolvedValue(admittedPlatform);
});

describe('🛑 the platform arm re-reads its membership on every request (ADR-0089)', () => {
  it('🛑 REFUSES an operator whose membership was revoked since sign-in — on the NEXT request', async () => {
    readPlatformDirectoryEntryByAccount.mockResolvedValue(
      platformEntry('2026-08-21T00:00:00.000Z'),
    );

    // 🛑 The SESSION is still perfectly valid — `assessRequestSession` admitted
    // it. A session says WHO; the membership says HOW FAR, and it is the
    // membership that changed.
    await expect(requireRequestScope()).rejects.toThrow(
      'NEXT_REDIRECT:/sign-in?refused=not-provisioned',
    );
  });

  it('🛑 REFUSES an operator whose account row is gone entirely', async () => {
    readPlatformDirectoryEntryByAccount.mockResolvedValue({ account: undefined, memberships: [] });

    await expect(requireRequestScope()).rejects.toThrow(
      'NEXT_REDIRECT:/sign-in?refused=not-provisioned',
    );
  });

  it('⚠️ NAMES NO REASON A BROWSER COULD MINE — the refusal is the same one the tenant arm gives', async () => {
    readPlatformDirectoryEntryByAccount.mockResolvedValue(
      platformEntry('2026-08-21T00:00:00.000Z'),
    );

    await expect(requireRequestScope()).rejects.toThrow('NEXT_REDIRECT:');

    const destination = redirect.mock.calls[0]?.[0] as string;

    // 🚫 It says "not provisioned", 🚫 never "revoked". The database declines to
    // distinguish absent from revoked and the console does not invent the
    // distinction to improve a log line.
    expect(destination).toBe('/sign-in?refused=not-provisioned');
    expect(destination).not.toContain(PLATFORM_ACCOUNT);
    expect(destination).not.toContain('revoked');
  });

  it('🛑 STILL ADMITS an operator whose membership stands — 🚫 the gate does not refuse everyone', async () => {
    const scoped = await requireRequestScope();

    expect(scoped.principal.scope).toBe('platform');
    expect(scoped.scope.kind).toBe('platform');
  });
});

describe('🛑 what the re-read is asked, and 🚫 what it can never be asked', () => {
  it('is asked about the account id the SESSION proved, 🚫 never an argument', async () => {
    await requireRequestScope();

    expect(readPlatformDirectoryEntryByAccount).toHaveBeenCalledTimes(1);
    expect(readPlatformDirectoryEntryByAccount).toHaveBeenCalledWith(PLATFORM_ACCOUNT);
  });

  it('🛑 is passed 🚫 NO organization — 🚫 not the pinned one, 🚫 not any one', async () => {
    await requireRequestScope();

    // 🛑 **THE ASSERTION IS ARITY, 🚫 "called with null".** Passing the pinned
    // organization here to make a re-read possible is the substitution ADR-0082
    // D4 forbids — it would read that agency's people and re-decide a platform
    // operator as a member of a tenant they are not in.
    const call = readPlatformDirectoryEntryByAccount.mock.calls[0] as readonly unknown[];

    expect(call).toHaveLength(1);
    expect(JSON.stringify(call)).not.toContain(PINNED_ORGANIZATION);
  });

  it('🚫 NEVER touches the TENANT directory on this arm', async () => {
    await requireRequestScope();

    // 🛑 "NOT CALLED", 🚫 not "called and returned nothing". A refusal that still
    // read the tenant directory has already asked a question about a tenant
    // nobody named.
    expect(readDirectoryEntryByAccount).not.toHaveBeenCalled();
  });

  it('🚫 NEVER touches the tenant directory even when the platform read refuses', async () => {
    readPlatformDirectoryEntryByAccount.mockResolvedValue(
      platformEntry('2026-08-21T00:00:00.000Z'),
    );

    await expect(requireRequestScope()).rejects.toThrow('NEXT_REDIRECT:');

    expect(readDirectoryEntryByAccount).not.toHaveBeenCalled();
  });
});
