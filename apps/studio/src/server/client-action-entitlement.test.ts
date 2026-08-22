import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **THE ORGANIZATION ON THE FORM IS NOT THE ORGANIZATION THAT DECIDES** —
 * AGE-INV-SEL-1, ADR-0074 §7 slice 3.
 *
 * 🛑 **THIS CLOSES A MEASURED GAP, 🚫 NOT A HYPOTHETICAL ONE.** The neighbouring
 * contracts assert that every `'use server'` function CALLS the boundary and
 * calls it FIRST. Neither says anything about what the function then does with
 * the session, and `createClientAction` is the one action that takes an
 * `organizationId` from the caller. Deleting its mismatch refusal outright left
 * all 265 tests in this app passing — measured, by making exactly that edit.
 *
 * 🛑 **WHAT THAT DEFECT WOULD HAVE BEEN.** A `'use server'` function is a
 * browser-reachable POST endpoint whose form payload is entirely under the
 * caller's control. With the refusal gone, any admitted operator could put a
 * record naming ANY organization into circulation — and every downstream reader
 * derives its scope FROM that record, so the forged scope would then look
 * exactly like a legitimate one.
 *
 * ⚠️ **IT ASSERTS THE REFUSAL, THE FIELD, AND THE SILENCE OF THE WRITER.** A
 * refusal that still wrote is not a refusal; a refusal that named a different
 * field cannot be acted on by the operator; and 🚫 the message must not disclose
 * anything about the organization the caller named.
 *
 * 🚫 **A MISMATCH IS REFUSED, NEVER SILENTLY REPLACED.** Overwriting the typed
 * organization with the session's would record a business the operator did not
 * describe, and the console would look as though it had accepted what was typed.
 */

const assessRequestSession = vi.fn();

const admittedTenant = (session: Record<string, unknown>) => ({
  kind: 'admitted' as const,
  // ⚠️ Narrowed because the boundary hands back a PRINCIPAL since ADR-0083 D1.
  // 🚫 A bare session here would be a shape the boundary cannot produce.
  principal: { scope: 'tenant' as const, session },
});

const createClientRecord = vi.fn();
const readDirectoryEntryByAccount = vi.fn();

// ⚠️ ADR-0089 — what the account-keyed platform read returns by default: a LIVE
// platform membership, obviously fictional (ADR-0053 D3, ADR-0065 D1).
const livePlatformEntry = {
  account: {
    accountId: 'account-fictional-platform',
    email: 'platform@fictional.invalid',
    disabledAt: null,
  },
  memberships: [
    {
      membershipId: 'membership-fictional-platform',
      accountId: 'account-fictional-platform',
      scopeKind: 'platform',
      organizationId: null,
      clientId: null,
      roleBundle: 'platform-operator',
      revokedAt: null,
    },
  ],
};

// ⚠️ The parameter is DECLARED even though the body ignores it: a zero-arity
// spy cannot record the account id it was asked about, and 🚫 an argument that
// is never recorded is an argument no guard can rule out.
const readPlatformDirectoryEntryByAccount = vi.fn(async (_accountId: string) => livePlatformEntry);

vi.mock('./session-boundary', () => ({
  assessRequestSession: () => assessRequestSession(),
}));

vi.mock('./operator-environment', () => ({
  createClientRecord: (draft: unknown) => createClientRecord(draft),
  // 🛑 ADR-0090 D1 — the action mints its own client id now, so this export
  // must exist here. ⚠️ Stubbed to a FIXED value on purpose: nothing in this
  // file is about the id's shape, and a random one would make its failures
  // unreadable. The shape is guarded in `minted-client-id-shape.test.ts`,
  // against the real module.
  mintClientId: () => 'cli_ffffffffffffffffffffffffffffffff',
  readDirectoryEntryByAccount: (organizationId: string, accountId: string) =>
    readDirectoryEntryByAccount(organizationId, accountId),
  // ⚠️ **ADR-0089 — THE PLATFORM ARM RE-READS ITS OWN MEMBERSHIP NOW**, so this
  // export must exist here or every platform case below fails on the mock
  // rather than on the behaviour it is asserting. 🛑 The default is a LIVE
  // platform membership, because these cases are about what an admitted
  // platform principal may do; the revocation case has its own file.
  readPlatformDirectoryEntryByAccount: (accountId: string) =>
    readPlatformDirectoryEntryByAccount(accountId),
}));

/**
 * 🛑 **SLICE 4 PUT A SECOND READ IN FRONT OF THIS ACTION, AND IT IS STUBBED
 * HONESTLY.** `requireScopedAccess` re-derives the scope from the store on every
 * request, so this test now supplies a real membership row rather than a session
 * alone. ⚠️ Stubbing the SCOPE instead of the ROW would have made the action
 * pass while proving nothing about the decision that guards it.
 */
const ACCOUNT = 'account-fictional-operator';

function agencyDirectoryEntry(organizationId: string) {
  return {
    account: { accountId: ACCOUNT, email: 'operator@fictional.invalid', disabledAt: null },
    memberships: [
      {
        membershipId: 'membership-fictional-1',
        accountId: ACCOUNT,
        scopeKind: 'agency',
        organizationId,
        clientId: null,
        roleBundle: 'agency-operator',
        revokedAt: null,
      },
    ],
  };
}

const { createClientAction } = await import('./client-actions');

const SESSION_ORGANIZATION = 'org-alpha';
const OTHER_ORGANIZATION = 'org-beta';

/**
 * ⚠️ **THE FORM NO LONGER CARRIES EITHER IDENTIFIER** (ADR-0090 D1, D2), and
 * this helper still lets a caller PUT one in — deliberately. A `'use server'`
 * function is a browser-reachable endpoint, so what the real form sends is 🚫 not
 * the same question as what a submission can carry.
 */
function formFor(organizationId: string): FormData {
  const form = new FormData();
  form.set('clientId', 'fictional-kite-repairs');
  form.set('organizationId', organizationId);
  form.set('displayName', 'Fictional Kite Repairs');
  form.set('externalRefsText', '');
  return form;
}

describe('creating a business inside the organization the session covers', () => {
  beforeEach(() => {
    assessRequestSession.mockReset();
    createClientRecord.mockReset();
    readDirectoryEntryByAccount.mockReset();
    assessRequestSession.mockResolvedValue(
      admittedTenant({
        sessionId: 'session-fictional-1',
        organizationId: SESSION_ORGANIZATION,
        accountId: ACCOUNT,
      }),
    );
    readDirectoryEntryByAccount.mockResolvedValue(agencyDirectoryEntry(SESSION_ORGANIZATION));
    createClientRecord.mockReturnValue({ kind: 'created' });
  });

  it('writes into the organization the session covers', async () => {
    const outcome = await createClientAction(formFor(SESSION_ORGANIZATION));

    expect(outcome).toEqual({ kind: 'created' });
    expect(createClientRecord).toHaveBeenCalledTimes(1);
    expect(createClientRecord.mock.calls[0]?.[0]).toMatchObject({
      organizationId: SESSION_ORGANIZATION,
    });
  });

  /**
   * 🛑 **THIS USED TO ASSERT A REFUSAL, AND THE REFUSAL IS GONE — 🚫 NOT
   * RELAXED, UNREACHABLE** (ADR-0090). The action reads neither identifier off
   * the submission, so there is nothing left to disagree with the session about.
   *
   * ⚠️ **The property that mattered is asserted here in its surviving form:**
   * a submission naming another organization still cannot get a record written
   * into that organization. 🚫 What changed is the OUTCOME an attempt produces —
   * a record in the caller's OWN organization rather than a refusal — and 🚫 that
   * is stated rather than quietly dropped.
   */
  it('🛑 ignores an organization the submission names, and writes to the session’s', async () => {
    const outcome = await createClientAction(formFor(OTHER_ORGANIZATION));

    expect(outcome).toEqual({ kind: 'created' });
    expect(createClientRecord).toHaveBeenCalledTimes(1);
    expect(createClientRecord.mock.calls[0]?.[0]).toMatchObject({
      organizationId: SESSION_ORGANIZATION,
    });
  });

  it('🚫 never writes a record into an organization the submission named', async () => {
    for (const named of [OTHER_ORGANIZATION, '', 'org-alpha ', 'ORG-ALPHA']) {
      createClientRecord.mockClear();
      await createClientAction(formFor(named));

      expect(createClientRecord.mock.calls[0]?.[0]).toMatchObject({
        organizationId: SESSION_ORGANIZATION,
      });
    }
  });

  it('🛑 establishes the session BEFORE it writes, on the happy path as well', async () => {
    const order: string[] = [];
    assessRequestSession.mockImplementation(async () => {
      order.push('boundary');
      return admittedTenant({ organizationId: SESSION_ORGANIZATION });
    });
    createClientRecord.mockImplementation(() => {
      order.push('write');
      return { kind: 'created' };
    });

    await createClientAction(formFor(SESSION_ORGANIZATION));

    expect(order).toEqual(['boundary', 'write']);
  });
});
