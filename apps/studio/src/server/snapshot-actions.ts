'use server';

import { readStoredSnapshot, type StoredSnapshotOutcome } from './operator-environment';
import { requireVerifiedSession } from './session-boundary';

/**
 * Read back the stored capture for one business (ADR-0064).
 *
 * ⚠️ AN ACTION, NEVER PAGE DATA — the same rule the other four screens follow.
 * Opening a screen must not open a database connection: the operator asks, once,
 * and the connection is opened and closed inside that ask.
 *
 * 🚫 IT CANNOT WRITE. The port it is given carries one read and a close, and
 * 🛑 no screen may seed a row to make the panel look populated (ADR-0064 D4).
 *
 * ⚠️ THE BIF ID IS THE OPERATOR'S, never derived. It was chosen when the
 * snapshot was captured, and finding it by listing snapshots is not authorized.
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
export async function readStoredSnapshotAction(
  clientId: string,
  bifId: string,
): Promise<StoredSnapshotOutcome> {
  const session = await requireVerifiedSession();

  return readStoredSnapshot(session.organizationId, clientId, bifId);
}
