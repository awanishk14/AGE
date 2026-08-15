'use server';

import { readDerivedIntelligence, type DerivedIntelligenceOutcome } from './operator-environment';
import { requireVerifiedSession } from './session-boundary';

/**
 * Deriving what AGE concludes, on the operator's press (ADR-0069 deliverable
 * 6c-2).
 *
 * ⚠️ **AN ACTION, NEVER PAGE DATA.** Deriving on open would make opening a
 * screen the act of connecting to two stores that hold a real business's
 * context and its relayed observations.
 *
 * 🚫 **THERE IS NO WRITE HERE, AND THERE MUST NOT BE.** Both façades this path
 * is handed carry reads and a close — no `append` on either. 🛑 A conclusion is
 * a COMPUTED PROJECTION (D2): it is recomputed on every press and stored
 * nowhere, so 🚫 do not add a "save this conclusion" action to make it stick.
 *
 * 🚫 **IT DECIDES NOTHING.** It forwards two arguments and returns the outcome
 * whole — refusals included, as results.
 *
 * 🛑 **THE ACTION ESTABLISHES ITS OWN ENTITLEMENT** (AGE-INV-SEL-1, ADR-0074 §7
 * slice 3). A `'use server'` function is a BROWSER-REACHABLE ENDPOINT, so the
 * `requireVerifiedSession()` call on the page that renders the button protects
 * the PAGE and 🚫 nothing else. 🚫 Do not remove this call on the grounds that
 * "the screen is already behind the boundary" — the screen is not what is
 * being called.
 *
 * ⚠️ The organization comes from the SESSION ROW, 🚫 never from an argument: an
 * argument would let the caller name whose data it wants, which is the exact
 * chain this invariant forbids.
 */
export async function readDerivedIntelligenceAction(
  clientId: string,
  bifId: string,
): Promise<DerivedIntelligenceOutcome> {
  const session = await requireVerifiedSession();

  return readDerivedIntelligence(session.organizationId, clientId, bifId);
}
