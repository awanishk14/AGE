import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **THE DEMONSTRATED CROSS-TENANT REFUSAL** — ADR-0079 §6 slice 4, which says in
 * as many words that this slice *"does 🚫 NOT merge without a demonstrated
 * cross-tenant refusal — proven by breaking the scope and watching a guard name
 * the exact violation, 🚫 never by an empty result set."*
 *
 * 🛑 **SO NOTHING HERE ASSERTS AN EMPTY RESULT.** Every case below asserts that
 * the action DID NOT RETURN and that the effect module WAS NOT CALLED. An empty
 * list is indistinguishable from a legitimately empty one, and a refusal that
 * still reached the store has already asked it whatever it was refusing to ask.
 *
 * 🛑 **THE SCOPE IS RE-READ ON THIS REQUEST, 🚫 NOT CARRIED ON THE SESSION**
 * (ADR-0079 §2 property 2). The session row in every case below is PERFECTLY
 * VALID — unexpired, unrevoked, admitted a minute ago. What changed is the
 * membership, and the whole point of the slice is that the very next request
 * notices.
 *
 * ⚠️ **THE ACTION UNDER TEST IS A READ.** A refusal on a writer proves the write
 * did not happen; a refusal on a READER is the one that proves nothing was
 * disclosed, and disclosure is what a tenant boundary exists to stop.
 */

const requireVerifiedSession = vi.fn();
const readStoredSnapshot = vi.fn();
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
  requireVerifiedSession: () => requireVerifiedSession(),
}));

vi.mock('./operator-environment', () => ({
  readStoredSnapshot: (...args: readonly unknown[]) => readStoredSnapshot(...args),
  readDirectoryEntryByAccount: (organizationId: string, accountId: string) =>
    readDirectoryEntryByAccount(organizationId, accountId),
}));

const { readStoredSnapshotAction } = await import('./snapshot-actions');

const SESSION_ORGANIZATION = 'org-fictional-alpha';
const OTHER_ORGANIZATION = 'org-fictional-beta';
const ACCOUNT = 'account-fictional-operator';
const CLIENT = 'client-fictional-kite-repairs';
const BIF = 'bif-fictional-1';

function membership(overrides: Record<string, unknown> = {}) {
  return {
    membershipId: 'membership-fictional-1',
    accountId: ACCOUNT,
    scopeKind: 'agency',
    organizationId: SESSION_ORGANIZATION,
    clientId: null,
    roleBundle: 'agency-operator',
    revokedAt: null,
    ...overrides,
  };
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    account: { accountId: ACCOUNT, email: 'operator@fictional.invalid', disabledAt: null },
    memberships: [membership()],
    ...overrides,
  };
}

beforeEach(() => {
  requireVerifiedSession.mockReset();
  readStoredSnapshot.mockReset();
  readDirectoryEntryByAccount.mockReset();
  notFound.mockClear();
  redirect.mockClear();

  // ⚠️ A VALID SESSION IN EVERY CASE, INCLUDING THE REFUSED ONES. If the session
  // were the thing being invalidated, these tests would prove only that the
  // ADR-0074 boundary still works — which was never in doubt.
  requireVerifiedSession.mockResolvedValue({
    sessionId: 'session-fictional-1',
    organizationId: SESSION_ORGANIZATION,
    accountId: ACCOUNT,
  });
  readStoredSnapshot.mockResolvedValue({ kind: 'found' });
});

describe('an operator whose membership still stands', () => {
  it('reaches the store, so the refusals below are refusals and not a broken wire', async () => {
    // 🛑 WITHOUT THIS, EVERY ASSERTION BELOW WOULD PASS AGAINST A BOUNDARY THAT
    // REFUSES EVERYONE — the guard would be measuring nothing and reporting it
    // as safety.
    readDirectoryEntryByAccount.mockResolvedValue(entry());

    const outcome = await readStoredSnapshotAction(CLIENT, BIF);

    expect(outcome).toEqual({ kind: 'found' });
    expect(readStoredSnapshot).toHaveBeenCalledWith(SESSION_ORGANIZATION, CLIENT, BIF);
  });

  it('reads the directory scoped to the session organization, 🚫 never to an argument', async () => {
    readDirectoryEntryByAccount.mockResolvedValue(entry());

    await readStoredSnapshotAction(CLIENT, BIF);

    // 🛑 AGE-INV-SEL-1. The caller supplied `clientId`; it supplied NOTHING that
    // reached the tenant position of this read.
    expect(readDirectoryEntryByAccount).toHaveBeenCalledWith(SESSION_ORGANIZATION, ACCOUNT);
  });
});

/**
 * 🛑 **THE CROSS-TENANT CASE ITSELF.** The account is real, the session is valid,
 * and the membership row is live — it simply belongs to ANOTHER organization.
 * ⚠️ That is the shape a mis-scoped read takes in practice: not a forged token,
 * but a row from the wrong tenant arriving where the right one was assumed.
 */
describe('an operator whose only live membership belongs to another organization', () => {
  it('is refused, and the store is NEVER reached', async () => {
    readDirectoryEntryByAccount.mockResolvedValue(
      entry({ memberships: [membership({ organizationId: OTHER_ORGANIZATION })] }),
    );

    await expect(readStoredSnapshotAction(CLIENT, BIF)).rejects.toThrow('NEXT_REDIRECT');

    // 🛑 🚫 NO EMPTY RESULT, 🚫 NO NULL, 🚫 NO `{}`. The action did not return at
    // all, and the effect module was never asked anything.
    expect(readStoredSnapshot).not.toHaveBeenCalled();
  });
});

describe('an operator whose membership was revoked after they signed in', () => {
  it('is refused on the NEXT request, 🚫 not at token expiry', async () => {
    readDirectoryEntryByAccount.mockResolvedValue(
      entry({ memberships: [membership({ revokedAt: '2026-08-18T00:00:00.000Z' })] }),
    );

    await expect(readStoredSnapshotAction(CLIENT, BIF)).rejects.toThrow('NEXT_REDIRECT');
    expect(readStoredSnapshot).not.toHaveBeenCalled();
  });
});

describe('an operator whose account was disabled', () => {
  it('is refused, and the store is NEVER reached', async () => {
    readDirectoryEntryByAccount.mockResolvedValue({
      account: {
        accountId: ACCOUNT,
        email: 'operator@fictional.invalid',
        disabledAt: '2026-08-18T00:00:00.000Z',
      },
      memberships: [membership()],
    });

    await expect(readStoredSnapshotAction(CLIENT, BIF)).rejects.toThrow('NEXT_REDIRECT');
    expect(readStoredSnapshot).not.toHaveBeenCalled();
  });
});

/**
 * 🛑 **A ROW THAT SAYS `platform` STILL ADMITS NOBODY.** ADR-0080 is `Proposed`
 * and authorizes nothing, so the super admin remains refused BY NAME here too.
 * ⚠️ The "just widen it" fix would show up as this test being DELETED, 🚫 not as
 * it being changed — which is the point of writing it down.
 */
describe('a platform membership', () => {
  it('is refused, and the store is NEVER reached', async () => {
    readDirectoryEntryByAccount.mockResolvedValue(
      entry({
        memberships: [
          membership({
            scopeKind: 'platform',
            roleBundle: 'platform-operator',
            organizationId: null,
          }),
        ],
      }),
    );

    await expect(readStoredSnapshotAction(CLIENT, BIF)).rejects.toThrow('NEXT_REDIRECT');
    expect(readStoredSnapshot).not.toHaveBeenCalled();
  });
});

/**
 * ⚠️ **A ROW THIS PRODUCT CANNOT EXPRESS IS REFUSED, 🚫 NEVER APPROXIMATED.** The
 * nearest scope that parses is always the WIDER one, so "close enough" here is a
 * grant nobody wrote down.
 */
describe('a membership whose bundle does not match its kind', () => {
  it('is refused, and the store is NEVER reached', async () => {
    readDirectoryEntryByAccount.mockResolvedValue(
      entry({ memberships: [membership({ roleBundle: 'client-viewer' })] }),
    );

    await expect(readStoredSnapshotAction(CLIENT, BIF)).rejects.toThrow('NEXT_REDIRECT');
    expect(readStoredSnapshot).not.toHaveBeenCalled();
  });
});

/**
 * ⚠️ **THE REFUSAL DISCLOSES NOTHING.** A refusal that named the other
 * organization would hand the caller the very identifier the boundary exists to
 * keep from them.
 */
describe('the refusal itself', () => {
  it('names no organization, no client and no account', async () => {
    readDirectoryEntryByAccount.mockResolvedValue(
      entry({ memberships: [membership({ organizationId: OTHER_ORGANIZATION })] }),
    );

    await expect(readStoredSnapshotAction(CLIENT, BIF)).rejects.toThrow();

    const destination = redirect.mock.calls[0]?.[0] ?? '';
    expect(destination).not.toContain(OTHER_ORGANIZATION);
    expect(destination).not.toContain(SESSION_ORGANIZATION);
    expect(destination).not.toContain(ACCOUNT);
    expect(destination).not.toContain(CLIENT);
  });
});
