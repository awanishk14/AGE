'use server';

import { generateBifFromAnswerFile, type GenerateBifOutcome } from './operator-environment';

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
 */
export async function generateBifAction(
  clientId: string,
  changedBy: string,
): Promise<GenerateBifOutcome> {
  return generateBifFromAnswerFile(clientId, changedBy);
}
