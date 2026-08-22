import { describe, expect, it, vi } from 'vitest';

/**
 * ADR-0090 §5 — the identity a new client record is given.
 *
 * 🛑 **THE OPERATOR TYPES NO IDENTIFIERS.** `clientId` is minted at the effect
 * edge and `organizationId` is derived from the session row. These are the
 * guards for that decision, and each one was proven by deliberately mutating
 * the implementation until it failed, and reading the failure, before it was
 * believed (constitution §5).
 */

const SESSION_ORGANIZATION = 'org-alpha';
const OTHER_ORGANIZATION = 'org-beta';

const createClientRecord = vi.fn(async (_draft: unknown) => ({
  kind: 'created' as const,
  clientId: 'unused',
  firstRecord: false,
}));

vi.mock('./request-scope', () => ({
  requireScopedAccess: async () => ({
    session: { organizationId: SESSION_ORGANIZATION },
  }),
}));

vi.mock('./operator-environment', async () => {
  const { randomBytes } = await import('node:crypto');
  return {
    createClientRecord: (draft: unknown) => createClientRecord(draft),
    mintClientId: () => `cli_${randomBytes(16).toString('hex')}`,
  };
});

const { createClientAction } = await import('./client-actions');

function submissionCarrying(fields: Readonly<Record<string, string>>): FormData {
  const form = new FormData();
  form.set('displayName', 'Fictional Kite Repairs');
  form.set('externalRefsText', '');
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  return form;
}

async function draftFromSubmission(form: FormData) {
  createClientRecord.mockClear();
  await createClientAction(form);
  return createClientRecord.mock.calls[0]?.[0] as {
    readonly clientId: string;
    readonly organizationId: string;
    readonly displayName: string;
  };
}

describe('ADR-0090 — a minted client identity', () => {
  // 🛑 GUARD 1 — the leak in §1c, asserted rather than described.
  it('🚫 does not derive the id from the display name', async () => {
    const draft = await draftFromSubmission(submissionCarrying({}));
    const normalised = draft.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const lowered = draft.clientId.toLowerCase();

    // Every run of three or more characters of the name is absent from the id.
    for (let start = 0; start + 3 <= normalised.length; start += 1) {
      expect(lowered).not.toContain(normalised.slice(start, start + 3));
    }
  });

  // 🛑 GUARD 2 — the case a name-derived mint fails, and it fails LOUDLY here
  // rather than quietly by overwriting the first business's record.
  it('gives two businesses of the same name two different ids', async () => {
    const first = await draftFromSubmission(submissionCarrying({}));
    const second = await draftFromSubmission(submissionCarrying({}));

    expect(first.displayName).toBe(second.displayName);
    expect(first.clientId).not.toBe(second.clientId);
  });

  // GUARD 4 — ⚠️ the field is gone from the form; 🚫 the gate behind it is not.
  it('writes into the session organization, whatever the submission carries', async () => {
    const draft = await draftFromSubmission(
      submissionCarrying({
        organizationId: OTHER_ORGANIZATION,
        clientId: 'fictional-kite-repairs',
      }),
    );

    expect(draft.organizationId).toBe(SESSION_ORGANIZATION);
    // 🛑 The submitted id is 🚫 not refused and 🚫 not sanitised — it is never
    // read, which is why the assertion is on the MINTED shape rather than on a
    // refusal that a later edit could reintroduce a path around.
    expect(draft.clientId).not.toBe('fictional-kite-repairs');
    expect(draft.clientId).toMatch(/^cli_[0-9a-f]{32}$/);
  });
});
