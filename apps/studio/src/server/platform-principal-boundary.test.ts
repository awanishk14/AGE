import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { SESSION_COOKIE_NAME } from '@age/session-cookie';
import { hashSessionToken } from '@age/session-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **WHAT A PLATFORM PRINCIPAL MAY DO ONCE IT IS ADMITTED** — ADR-0083 **D1** and
 * **D4**.
 *
 * 🛑 **ADMISSION IS 🚫 NOT AUTHORIZATION, AND ADMISSION IS 🚫 NOT RENDERING.**
 * ADR-0083 authorizes the SHAPE of this principal and says in as many words that
 * it is *"🚫 not a rendering, 🚫 not a reach"*. So every case below asserts a
 * principal that IS signed in and that STILL reaches nothing: the sixteen tenant
 * pages refuse it, the action gate refuses it, and the only thing it gains is
 * knowledge of its own scope.
 *
 * 🛑 **NO CASE HERE ASSERTS AN EMPTY RESULT.** Each asserts that the function did
 * ❌ not return AND that the tenant read was never performed — a refusal that
 * still read the directory has already asked a question about a tenant nobody
 * named.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const assessRequestSession = vi.fn();
const readDirectoryEntryByAccount = vi.fn();
const revokeSessionById = vi.fn();
const revokePlatformSessionByDigest = vi.fn();
const sessionLookupOrganizationId = vi.fn(() => 'org-fictional-alpha');
const verifySessionToken = vi.fn();
const cookieHeader = vi.fn((): string | undefined => undefined);

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

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => (name === 'cookie' ? cookieHeader() : null) }),
}));

vi.mock('./operator-environment', () => ({
  readDirectoryEntryByAccount: (organizationId: string, accountId: string) =>
    readDirectoryEntryByAccount(organizationId, accountId),
  revokeSessionById: (...args: readonly unknown[]) => revokeSessionById(...args),
  revokePlatformSessionByDigest: (...args: readonly unknown[]) =>
    revokePlatformSessionByDigest(...args),
  sessionLookupOrganizationId: () => sessionLookupOrganizationId(),
  verifySessionToken: (...args: readonly unknown[]) => verifySessionToken(...args),
}));

// ⚠️ The scope module is exercised against a MOCKED boundary, because what it is
// under test for is the branch it takes on a principal — 🚫 not how that
// principal was verified.
vi.mock('./session-boundary', () => ({
  assessRequestSession: () => assessRequestSession(),
}));

const { requireRequestScope, requireScopedAccess } = await import('./request-scope');

// 🛑 THE LOGOUT CASES IMPORT THE REAL BOUNDARY. `vi.unmock` alone would not undo
// the factory above for a module already in the graph, so the revocation tests
// below reach for the unmocked copy explicitly — otherwise they would be
// asserting against a stub of the very branch they exist to prove.
const realBoundary =
  await vi.importActual<typeof import('./session-boundary')>('./session-boundary');

const PLATFORM_SESSION = 'session-fictional-platform-1';
const PLATFORM_ACCOUNT = 'account-fictional-platform-1';
const TENANT_ORGANIZATION = 'org-fictional-alpha';
const TOKEN = 'e'.repeat(64);

const platformSession = {
  sessionId: PLATFORM_SESSION,
  accountId: PLATFORM_ACCOUNT,
};

const tenantSession = {
  sessionId: 'session-fictional-1',
  organizationId: TENANT_ORGANIZATION,
  accountId: 'account-fictional-1',
};

const admittedPlatform = {
  kind: 'admitted' as const,
  principal: { scope: 'platform' as const, session: platformSession },
};

const admittedTenant = {
  kind: 'admitted' as const,
  principal: { scope: 'tenant' as const, session: tenantSession },
};

// ⚠️ What the STORE returned. The boundary tests below feed this in and let
// the real decision, the real branch and the real digest run.
const verifiedPlatform = {
  outcome: 'verified' as const,
  principal: { scope: 'platform' as const, session: platformSession },
};

const verifiedTenant = {
  outcome: 'verified' as const,
  principal: { scope: 'tenant' as const, session: tenantSession },
};

beforeEach(() => {
  assessRequestSession.mockReset();
  readDirectoryEntryByAccount.mockReset();
  revokeSessionById.mockReset();
  revokePlatformSessionByDigest.mockReset();
  verifySessionToken.mockReset();
  notFound.mockClear();
  redirect.mockClear();
  cookieHeader.mockReset();
  cookieHeader.mockReturnValue(undefined);
});

describe('requireRequestScope, given a platform principal (ADR-0083 D4)', () => {
  it('🛑 hands back the platform scope, and the principal keeps its scope tag', async () => {
    assessRequestSession.mockResolvedValue(admittedPlatform);

    const scoped = await requireRequestScope();

    expect(scoped.principal.scope).toBe('platform');
    expect(scoped.scope.kind).toBe('platform');
  });

  it('🚫 NEVER reads the tenant directory on this arm', async () => {
    assessRequestSession.mockResolvedValue(admittedPlatform);

    await requireRequestScope();

    // 🛑 THE ASSERTION IS "NOT CALLED", 🚫 NOT "CALLED WITH null". Passing the
    // deployment's pinned organization here to make a re-read possible is the
    // substitution ADR-0082 D4 forbids — it would answer a question about a
    // tenant this principal never named.
    expect(readDirectoryEntryByAccount).not.toHaveBeenCalled();
  });

  it('⚠️ still reads the directory for a TENANT principal — the arm above is a branch, 🚫 not a deletion', async () => {
    assessRequestSession.mockResolvedValue(admittedTenant);
    readDirectoryEntryByAccount.mockResolvedValue({
      account: {
        accountId: 'account-fictional-1',
        email: 'operator@fictional.invalid',
        disabledAt: null,
      },
      memberships: [
        {
          membershipId: 'membership-fictional-1',
          accountId: 'account-fictional-1',
          scopeKind: 'agency',
          organizationId: TENANT_ORGANIZATION,
          clientId: null,
          roleBundle: 'agency-operator',
          revokedAt: null,
        },
      ],
    });

    const scoped = await requireRequestScope();

    expect(readDirectoryEntryByAccount).toHaveBeenCalledWith(
      TENANT_ORGANIZATION,
      'account-fictional-1',
    );
    expect(scoped.scope.kind).not.toBe('platform');
  });
});

describe('requireScopedAccess, given a platform principal', () => {
  it('🛑 refuses — and the caller does ❌ NOT get a value back', async () => {
    assessRequestSession.mockResolvedValue(admittedPlatform);

    await expect(requireScopedAccess('snapshot.read', null)).rejects.toThrow('NEXT_NOT_FOUND');

    // ⚠️ AN OPAQUE 404, 🚫 not a 403 and 🚫 not an empty scope. The refusal is
    // indistinguishable from the page not existing.
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('🚫 is refused for having no SUBJECT — 🚫 not for lacking the capability', async () => {
    assessRequestSession.mockResolvedValue(admittedPlatform);

    // 🛑 `platformScope()` holds EVERY atom, so a refusal coming out of
    // `decideAccess` would be a DIFFERENT refusal wearing the same 404. These
    // are refused before that call is reached — which is why the directory read
    // below never happened either.
    await expect(requireScopedAccess('snapshot.read', null)).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(requireScopedAccess('client.read', 'client-fictional-1')).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );

    expect(readDirectoryEntryByAccount).not.toHaveBeenCalled();
  });
});

/**
 * ⚠️ **THESE DRIVE THE REAL BOUNDARY, 🚫 NOT A MOCK OF IT.** The verification
 * is what the STORE returned; everything between that row and the revocation
 * call — the decision, the branch, the digest — is the shipped code.
 */
describe('endRequestSession, given a platform principal (ADR-0083 D5)', () => {
  it('🛑 revokes through the DIGEST FENCE, and 🚫 never through the tenant path', async () => {
    verifySessionToken.mockResolvedValue(verifiedPlatform);
    revokePlatformSessionByDigest.mockResolvedValue('revoked');
    cookieHeader.mockReturnValue(`${SESSION_COOKIE_NAME}=${TOKEN}`);

    const outcome = await realBoundary.endRequestSession();

    expect(outcome).toBe('revoked');
    // 🛑 THE DIGEST, 🚫 NEVER THE TOKEN. The fence is `hashSessionToken`'s one
    // implementation, and the raw token reaches no argument.
    expect(revokePlatformSessionByDigest).toHaveBeenCalledWith(
      hashSessionToken(TOKEN),
      PLATFORM_SESSION,
    );
    expect(JSON.stringify(revokePlatformSessionByDigest.mock.calls)).not.toContain(TOKEN);
    expect(revokeSessionById).not.toHaveBeenCalled();
  });

  it('🚫 fences on the digest of the token THIS REQUEST presented, 🚫 not a remembered one', async () => {
    const other = 'f'.repeat(64);
    verifySessionToken.mockResolvedValue(verifiedPlatform);
    revokePlatformSessionByDigest.mockResolvedValue('revoked');
    cookieHeader.mockReturnValue(`${SESSION_COOKIE_NAME}=${other}`);

    await realBoundary.endRequestSession();

    // ⚠️ THE PRINCIPAL CARRIES ❌ NO CREDENTIAL MATERIAL, so a fence that did
    // not come from the cookie could only have come from somewhere it must not.
    expect(revokePlatformSessionByDigest).toHaveBeenCalledWith(
      hashSessionToken(other),
      PLATFORM_SESSION,
    );
  });

  it('⚠️ a TENANT principal still logs out by organization — 🚫 the fence did not replace it', async () => {
    verifySessionToken.mockResolvedValue(verifiedTenant);
    revokeSessionById.mockResolvedValue('revoked');
    cookieHeader.mockReturnValue(`${SESSION_COOKIE_NAME}=${TOKEN}`);

    expect(await realBoundary.endRequestSession()).toBe('revoked');
    expect(revokeSessionById).toHaveBeenCalledWith(TENANT_ORGANIZATION, 'session-fictional-1');
    expect(revokePlatformSessionByDigest).not.toHaveBeenCalled();
  });

  it('🚫 ends NOTHING when no cookie is presented, and 🚫 never reaches the store', async () => {
    cookieHeader.mockReturnValue(undefined);

    expect(await realBoundary.endRequestSession()).toBe('already-ended');
    expect(verifySessionToken).not.toHaveBeenCalled();
    expect(revokePlatformSessionByDigest).not.toHaveBeenCalled();
    expect(revokeSessionById).not.toHaveBeenCalled();
  });
});

describe('requireVerifiedSession, given a platform principal', () => {
  it('🛑 refuses a TENANT PAGE to a signed-in platform operator', async () => {
    verifySessionToken.mockResolvedValue(verifiedPlatform);
    cookieHeader.mockReturnValue(`${SESSION_COOKIE_NAME}=${TOKEN}`);

    // ⚠️ THE REDIRECT NAMES THE SCOPE, 🚫 not a credential problem. This
    // operator IS signed in; what they are being told is that this console's
    // pages render one agency's work.
    await expect(realBoundary.requireVerifiedSession()).rejects.toThrow(
      'NEXT_REDIRECT:/sign-in?refused=scope-not-served',
    );
  });

  it('⚠️ a TENANT principal still gets its session back — 🚫 the refusal above is not a blanket one', async () => {
    verifySessionToken.mockResolvedValue(verifiedTenant);
    cookieHeader.mockReturnValue(`${SESSION_COOKIE_NAME}=${TOKEN}`);

    expect(await realBoundary.requireVerifiedSession()).toEqual(tenantSession);
  });
});

/**
 * 🛑 **PRODUCT-WIDE, 🚫 NOT PACKAGE-WIDE.** ADR-0083 D4 says the branch between
 * the two principals lives in `requireRequestScope` *and nowhere else*. ⚠️ A scan
 * narrower than the rule it asserts is the single pattern that produced every
 * audit gap on this track — so this walks `packages/` and `apps/`.
 */
describe('🛑 a platform scope comes into existence at EXACTLY ONE call site', () => {
  const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
  const EXCLUDED = new Set(['node_modules', 'dist', '.nx', '.next']);

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      if (EXCLUDED.has(entry)) return [];
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
    });
  }

  const ROOTS = ['packages', 'apps'].map((dir) => join(REPO_ROOT, dir)).filter(existsSync);
  const REPO_FILES = ROOTS.flatMap((root) => sourceFiles(root));

  const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  const relative = (file: string): string =>
    file
      .slice(REPO_ROOT.length + 1)
      .split('\\')
      .join('/');

  const productionFiles = REPO_FILES.filter(
    (file) => !file.endsWith('.spec.ts') && !file.endsWith('.test.ts'),
  ).filter((file) => !relative(file).startsWith('packages/access-scope/'));

  it('walked the repository rather than trusting one path', () => {
    expect(REPO_FILES.length).toBeGreaterThan(200);
  });

  // ⚠️ **THE IMPORTER RULE IS 🚫 NOT RE-ASSERTED HERE.**
  // `packages/access-scope/src/tests/guards.spec.ts` already asserts, product-wide,
  // that this module is `@age/access-scope`'s only importer — and it counts test
  // files too, so it is the STRICTER of the two. 🚫 A second copy of that rule is
  // the drift this repository refuses by name: the copy that gets relaxed still
  // passes its own tests. What is new below is the CALL SITE rule, which no
  // shipped guard covered.
  it('🚫 `platformScope()` is CALLED from exactly one module', () => {
    const callers = productionFiles
      .filter((file) => /platformScope\(\)/.test(stripComments(readFileSync(file, 'utf8'))))
      .map(relative);

    expect(callers).toEqual(['apps/studio/src/server/request-scope.ts']);
  });
});
