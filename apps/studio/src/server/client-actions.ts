'use server';

import { clientRecordDraftFromFormEntries } from '@age/studio-shell';

import { createClientRecord, mintClientId, type CreateClientOutcome } from './operator-environment';
import { requireScopedAccess } from './request-scope';

/**
 * Creating a client — the operator's explicit act.
 *
 * 🚫 There is no autosave here and there must not be one. A half-typed identity
 * written to the record file would put a scope into circulation that names a
 * business the operator had not finished describing; unlike a discovery draft,
 * a partial record is read by everything downstream.
 *
 * ⚠️ Effects stay in ONE module: this file converts a form payload and calls
 * `operator-environment`.
 *
 * 🛑 **IT ESTABLISHES ITS OWN ENTITLEMENT, AND CREATION IS THE ONE PLACE THE
 * INVARIANT BITES HARDEST** (AGE-INV-SEL-1, ADR-0074 §7 slice 3). A
 * `'use server'` function is a BROWSER-REACHABLE ENDPOINT, and this one WRITES:
 * before slice 3 a caller with no session at all could POST a record naming any
 * organization they liked and put a scope into circulation.
 *
 * 🛑 **NEITHER IDENTIFIER COMES OFF THE FORM** (ADR-0090 D1, D2). `clientId`
 * is MINTED here and `organizationId` is DERIVED from the session row. ⚠️ The
 * earlier shape asked the operator to TYPE an organization the server would
 * accept in exactly one value — a recall test whose only feedback was a
 * refusal — and asked them to invent a `clientId`, which in practice meant
 * slugging the business's NAME into every URL and workspace filename.
 *
 * ⚠️ **THE OLD RULE WAS "a mismatched organization is refused, never silently
 * replaced", AND IT HAS 🚫 NOT BEEN RELAXED — IT HAS BEEN MADE UNREACHABLE.**
 * There is nothing to mismatch when nothing is read from the submission:
 * `clientRecordDraftFromFormEntries` takes the identity as its second argument
 * and 🚫 never looks at `entries.organizationId`. 🛑 A submission that carries
 * one anyway is 🚫 not refused and 🚫 not sanitised; it is simply never read,
 * which is the one handling a later edit cannot quietly get wrong.
 */
export async function createClientAction(formData: FormData): Promise<CreateClientOutcome> {
  const { session } = await requireScopedAccess('client.create', null);

  const entries: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      entries[key] = value;
    }
  }

  // 🛑 THE IDENTITY IS ESTABLISHED HERE, FROM THE SESSION AND FROM RANDOMNESS —
  // 🚫 never from `entries`, which is whatever a browser sent.
  const draft = clientRecordDraftFromFormEntries(entries, {
    clientId: mintClientId(),
    organizationId: session.organizationId,
  });

  return createClientRecord(draft);
}
