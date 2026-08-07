'use server';

import { reportContradictions, type ContradictionsOutcome } from './operator-environment';

/**
 * The one thing the operator can do on the Contradictions screen.
 *
 * 🚫 THIS DOES NOT DETECT CONTRADICTIONS AND MUST NEVER BE RENAMED AS THOUGH IT
 * DOES. It reports why the real detector cannot yet be run for this business.
 *
 * ⚠️ An ACTION, never page data — reporting on open would make opening the
 * screen the act, and a recompute-on-open is class 3 under ADR-0057 D4 even
 * though its effect is entirely internal.
 */
export async function reportContradictionsAction(
  clientId: string,
  changedBy: string,
): Promise<ContradictionsOutcome> {
  return reportContradictions(clientId, changedBy);
}
