'use server';

import { clientRecordDraftFromFormEntries } from '@age/studio-shell';

import { createClientRecord, type CreateClientOutcome } from './operator-environment';
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
 * 🛑 **A MISMATCHED ORGANIZATION IS REFUSED, 🚫 NEVER SILENTLY REPLACED.** The
 * organization is on the form because the operator types it, so overwriting it
 * with the session's would record a record the operator did not describe — and
 * the console would look as though it had accepted what was typed. ⚠️ Refusing
 * names the FIELD, so the operator can see what disagreed; 🚫 it does not
 * disclose anything about the organization they named.
 */
export async function createClientAction(formData: FormData): Promise<CreateClientOutcome> {
  const { session } = await requireScopedAccess('client.create', null);

  const entries: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      entries[key] = value;
    }
  }

  const draft = clientRecordDraftFromFormEntries(entries);

  if (draft.organizationId !== session.organizationId) {
    return {
      kind: 'refused',
      reason:
        'A business can only be created inside the organization this session covers. Nothing ' +
        'was written, and no other organization was consulted.',
      field: 'organizationId',
    };
  }

  return createClientRecord(draft);
}
