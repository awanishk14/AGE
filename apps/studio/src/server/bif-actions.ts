'use server';

import { generateBifFromAnswerFile, type GenerateBifOutcome } from './operator-environment';
import { requireScopedAccess } from './request-scope';

/**
 * The one thing the operator can do on the BIF screen.
 *
 * ⚠️ It exists as an ACTION, not as page data, on purpose. If the page produced
 * a BIF while rendering, opening the screen would itself be the act — and a
 * recompute-on-open is class 3 under ADR-0057 D4 even though its effect is
 * entirely internal. The operator presses a button; nothing else ever calls
 * this.
 *
 * ⚠️ `changedBy` is passed through untouched and un-defaulted. There is no
 * identity in AGE yet (ADR-0058 is `Proposed`), so the operator types who is
 * recording this. 🚫 A generated or inferred principal would write a name into
 * provenance that nobody claimed (ADR-0053 D4).
 *
 * 🚫 This file decides nothing and touches nothing — effects stay in the one
 * effect module.
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
export async function generateBifAction(
  clientId: string,
  changedBy: string,
): Promise<GenerateBifOutcome> {
  const { session } = await requireScopedAccess('snapshot.score', clientId);

  return generateBifFromAnswerFile(session.organizationId, clientId, changedBy);
}
