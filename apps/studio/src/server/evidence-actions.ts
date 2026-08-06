'use server';

import { assembleEvidence, type EvidenceOutcome } from './operator-environment';

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
 */
export async function assembleEvidenceAction(
  clientId: string,
  changedBy: string,
): Promise<EvidenceOutcome> {
  return assembleEvidence(clientId, changedBy);
}
