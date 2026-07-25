/**
 * The transaction boundary row-level security requires (ADR-0033 D7).
 *
 * Under the accepted policy a row is visible, and a row may be written, only
 * when `age.client_id` and `age.organization_id` both match it. Those settings
 * are transaction-local — `SET LOCAL` / `set_config(..., true)` — because a
 * session-level setting outlives its work and, behind a connection pool, leaks
 * to whoever borrows the connection next. Transaction-local means every query
 * against the table has to run inside a transaction that set both values first.
 *
 * That is the largest practical consequence ADR-0033 named, and this interface
 * is the whole of it: one hook that owns "open a transaction, apply the scope,
 * hand back a delegate". Nothing here knows about Prisma, SQL, or connections —
 * the implementation lives at the composition root, which is the only place
 * that has a client to open a transaction on.
 *
 * WHY NOT WIDEN `ScoredBifSnapshotDelegate`. Adding a transaction method to the
 * delegate would put connection management inside the shape the adapter uses to
 * read and write rows, and every future implementer of that shape — including
 * the table doubles — would have to model transactions to satisfy it. Keeping
 * the two separate leaves the delegate exactly as narrow as it was: still no
 * `update`, no `delete`, no `upsert`.
 */

import type { ScoredBifSnapshotDelegate } from './scored-bif-snapshot-delegate';

/**
 * The scope a transaction runs under. These are the caller's `ClientContext`
 * ids (ADR-0009, ADR-0031 D5) and nothing else: never read from
 * `ScoredBifContext`, from the snapshot payload, or from any other data the
 * caller supplies as content.
 */
export interface ScoredBifSnapshotScope {
  readonly clientId: string;
  readonly organizationId: string;
}

export interface ScoredBifSnapshotScopeRunner {
  /**
   * Runs `operation` inside a single transaction in which both scope settings
   * have been applied. The delegate handed to `operation` must be bound to that
   * same transaction — a delegate from another connection would run outside the
   * scope, and fail closed.
   */
  runInScope<T>(
    scope: ScoredBifSnapshotScope,
    operation: (snapshots: ScoredBifSnapshotDelegate) => Promise<T>,
  ): Promise<T>;
}
