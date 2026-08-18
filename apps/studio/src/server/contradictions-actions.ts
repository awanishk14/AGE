'use server';

import { reportContradictions, type ContradictionsOutcome } from './operator-environment';
import { requireScopedAccess } from './request-scope';

/**
 * The one thing the operator can do on the Contradictions screen.
 *
 * 🚫 THIS DOES NOT DETECT CONTRADICTIONS AND MUST NEVER BE RENAMED AS THOUGH IT
 * DOES. It reports why the real detector cannot yet be run for this business.
 *
 * ⚠️ An ACTION, never page data — reporting on open would make opening the
 * screen the act, and a recompute-on-open is class 3 under ADR-0057 D4 even
 * though its effect is entirely internal.
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
export async function reportContradictionsAction(
  clientId: string,
  changedBy: string,
): Promise<ContradictionsOutcome> {
  const { session } = await requireScopedAccess('snapshot.score', clientId);

  return reportContradictions(session.organizationId, clientId, changedBy);
}
