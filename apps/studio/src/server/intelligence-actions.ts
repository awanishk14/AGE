'use server';

import { assessCapabilityReadiness, type CapabilityReadinessOutcome } from './operator-environment';

/**
 * The one thing the operator can do on the Intelligence screen.
 *
 * ⚠️ An ACTION, never page data — the same reason as the BIF and Evidence
 * screens. Assessing on open would make opening the screen the act, and a
 * recompute-on-open is class 3 under ADR-0057 D4 even though its effect is
 * entirely internal.
 *
 * 🚫 THIS DOES NOT RUN A CAPABILITY. It asks each capability that publishes an
 * ADR-0027 assessment how far the captured context carries it. Nothing is
 * produced, nothing is stored, and no capability is executed against a real
 * business.
 */
export async function assessCapabilityReadinessAction(
  clientId: string,
  changedBy: string,
): Promise<CapabilityReadinessOutcome> {
  return assessCapabilityReadiness(clientId, changedBy);
}
