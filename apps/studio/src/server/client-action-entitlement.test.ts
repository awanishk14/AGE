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

vi.mock('./session-boundary', () => ({
  assessRequestSession: () => assessRequestSession(),
}));

vi.mock('./operator-environment', () => ({
  createClientRecord: (draft: unknown) => createClientRecord(draft),
  readDirectoryEntryByAccount: (organizationId: string, accountId: string) =>
    readDirectoryEntryByAccount(organizationId, accountId),
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

  it('writes when the form names the session’s own organization', async () => {
    const outcome = await createClientAction(formFor(SESSION_ORGANIZATION));

    expect(outcome).toEqual({ kind: 'created' });
    expect(createClientRecord).toHaveBeenCalledTimes(1);
    expect(createClientRecord.mock.calls[0]?.[0]).toMatchObject({
      organizationId: SESSION_ORGANIZATION,
    });
  });

  it('🛑 refuses a form naming another organization — and writes NOTHING', async () => {
    const outcome = await createClientAction(formFor(OTHER_ORGANIZATION));

    expect(outcome.kind).toBe('refused');
    expect(createClientRecord).not.toHaveBeenCalled();
  });

  it('🛑 names the FIELD that disagreed, so the operator can see what to correct', async () => {
    const outcome = await createClientAction(formFor(OTHER_ORGANIZATION));

    expect(outcome).toMatchObject({ kind: 'refused', field: 'organizationId' });
  });

  it('🚫 discloses nothing about the organization the caller named', async () => {
    const outcome = await createClientAction(formFor(OTHER_ORGANIZATION));
    const reason = outcome.kind === 'refused' ? outcome.reason : '';

    expect(reason.length).toBeGreaterThan(0);
    expect(reason).not.toContain(OTHER_ORGANIZATION);
    expect(reason).not.toContain(SESSION_ORGANIZATION);
  });

  it('🚫 does not silently replace the typed organization with the session’s', async () => {
    await createClientAction(formFor(OTHER_ORGANIZATION));

    expect(createClientRecord).not.toHaveBeenCalled();
  });

  it('🛑 refuses an EMPTY organization too — absence is not agreement', async () => {
    const outcome = await createClientAction(formFor(''));

    expect(outcome.kind).toBe('refused');
    expect(createClientRecord).not.toHaveBeenCalled();
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
