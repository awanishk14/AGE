'use server';

import { readStoredSnapshot, type StoredSnapshotOutcome } from './operator-environment';

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
 */
export async function readStoredSnapshotAction(
  clientId: string,
  bifId: string,
): Promise<StoredSnapshotOutcome> {
  return readStoredSnapshot(clientId, bifId);
}
