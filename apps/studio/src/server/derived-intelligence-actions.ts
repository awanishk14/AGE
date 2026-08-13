'use server';

import { readDerivedIntelligence, type DerivedIntelligenceOutcome } from './operator-environment';

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
 */
export async function readDerivedIntelligenceAction(
  clientId: string,
  bifId: string,
): Promise<DerivedIntelligenceOutcome> {
  return readDerivedIntelligence(clientId, bifId);
}
