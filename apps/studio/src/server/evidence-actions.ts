'use server';

import { assembleEvidence, type EvidenceOutcome } from './operator-environment';
import { requireScopedAccess } from './request-scope';

/**
 * The one thing the operator can do on the Evidence screen.
 *
 * ⚠️ An ACTION, never page data — the same reason as the BIF screen. Assembling
 * on open would make opening the screen the act, and a recompute-on-open is
 * class 3 under ADR-0057 D4 even though its effect is entirely internal.
 *
 * 🚫 This is not "check the evidence". Nothing is opened, fetched or contacted:
 * it reads the answer file and reports what the capture does and does not
 * support.
 *
 * 🛑 **SLICE 4: THE GUARD IS NOW `requireScopedAccess`, AND IT NAMES A
 * CAPABILITY AND A SUBJECT.** Being admitted is 🚫 not being authorized: the
 * session says WHO is asking, and the scope - re-read from the store on THIS
 * request, 🚫 never carried on the token - says how far. ⚠️ A refusal leaves as
 * an opaque 404, 🚫 never an empty result.
 *
 * 🛑 **THE ACTION ESTABLISHES ITS OWN ENTITLEMENT** (AGE-INV-SEL-1, ADR-0074 §7
 * slice 3). A `'use server'` function is a BROWSER-REACHABLE ENDPOINT, so the
 * `requireScopedAccess()` call on the page that renders the button protects
 * the PAGE and 🚫 nothing else. 🚫 Do not remove this call on the grounds that
 * "the screen is already behind the boundary" — the screen is not what is
 * being called.
 *
 * ⚠️ The organization comes from the SESSION ROW, 🚫 never from an argument: an
 * argument would let the caller name whose data it wants, which is the exact
 * chain this invariant forbids.
 */
export async function assembleEvidenceAction(
  clientId: string,
  changedBy: string,
): Promise<EvidenceOutcome> {
  const { session } = await requireScopedAccess('snapshot.score', clientId);

  return assembleEvidence(session.organizationId, clientId, changedBy);
}
