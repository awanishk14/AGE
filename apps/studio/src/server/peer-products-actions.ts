'use server';

import { readRelayedObservations, type RelayedObservationsOutcome } from './operator-environment';

/**
 * The one thing the operator can do on the Peer Products screen: read what has
 * been relayed (ADR-0069 deliverable 6).
 *
 * ⚠️ **AN ACTION, NEVER PAGE DATA.** Reading on open would make opening a screen
 * the act of connecting to the store that holds a real business's relayed
 * observations.
 *
 * 🚫 **THERE IS NO RELAY ACTION HERE, AND THERE MUST NOT BE.** The façade this
 * path is handed carries `listForOrganization` and `close` — no `append`. The
 * relay is a separate, operator-mediated act on a separate path (ADR-0069 D3),
 * and a "just add one" button on a read screen would be that act arriving
 * without its own decision.
 */
export async function readRelayedObservationsAction(
  clientId: string,
): Promise<RelayedObservationsOutcome> {
  return readRelayedObservations(clientId);
}
