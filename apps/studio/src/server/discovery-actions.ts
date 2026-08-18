'use server';

import { draftFromFormEntries } from '@age/studio-shell';

import {
  readDiscoveryDraft,
  STUDIO_QUESTIONNAIRE,
  submitDiscoveryAnswers,
  writeDiscoveryDraft,
  type DraftOutcome,
  type SaveOutcome,
  type SubmitOutcome,
} from './operator-environment';
import { requireScopedAccess } from './request-scope';

/**
 * The two things the operator can do on the Discovery screen.
 *
 * ⚠️ Both are invoked by the operator's own browser, from their own typing.
 * 🚫 Neither may be triggered by a schedule, a retry or a recompute — those are
 * system-initiated and therefore class 3, even though the effect is internal.
 *
 * ⚠️ Effects still live in ONE module: this file decides nothing and touches
 * nothing. It converts a form payload into a draft and calls
 * `operator-environment`.
 *
 * 🛑 **EVERY ONE OF THEM ESTABLISHES ITS OWN ENTITLEMENT** (AGE-INV-SEL-1,
 * ADR-0074 §7 slice 3). A `'use server'` function is a BROWSER-REACHABLE
 * ENDPOINT: the `requireScopedAccess()` call on the page that renders the
 * form protects the PAGE and 🚫 nothing else. ⚠️ The WRITE doors are gated too —
 * a gate on the read alone would leave a caller unable to see another
 * organization's draft and still able to overwrite it.
 */

function entriesFrom(formData: FormData): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      entries[key] = value;
    }
  }
  return entries;
}

/** Autosave. Preserves the operator's typing; initiates nothing. */
export async function saveDiscoveryDraftAction(
  clientId: string,
  formData: FormData,
): Promise<SaveOutcome> {
  const { session } = await requireScopedAccess('snapshot.capture', clientId);

  return writeDiscoveryDraft(
    session.organizationId,
    clientId,
    draftFromFormEntries(entriesFrom(formData), STUDIO_QUESTIONNAIRE),
  );
}

/** Submit — the operator's explicit act. Writes the canonical Answer File. */
export async function submitDiscoveryAction(
  clientId: string,
  formData: FormData,
): Promise<SubmitOutcome> {
  const { session } = await requireScopedAccess('snapshot.capture', clientId);
  const draft = draftFromFormEntries(entriesFrom(formData), STUDIO_QUESTIONNAIRE);

  // ⚠️ The draft is saved FIRST. If writing the answer file fails, the
  // operator's typing must still survive — losing it to a failed submit is the
  // one outcome autosave exists to prevent.
  writeDiscoveryDraft(session.organizationId, clientId, draft);

  return submitDiscoveryAnswers(session.organizationId, clientId, draft);
}

/** Read the stored draft for the initial render. */
export async function loadDiscoveryDraftAction(clientId: string): Promise<DraftOutcome> {
  const { session } = await requireScopedAccess('snapshot.read', clientId);

  return readDiscoveryDraft(session.organizationId, clientId);
}
