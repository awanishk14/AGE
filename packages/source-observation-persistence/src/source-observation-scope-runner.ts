/**
 * The transaction boundary `source_observations` requires (ADR-0069
 * deliverable 2, on the ADR-0033 D7 pattern).
 *
 * Under the accepted policy a row is visible, and a row may be written, only
 * when `age.organization_id` matches it. That setting is transaction-local —
 * `set_config(..., true)` — because a session-level setting outlives its work
 * and, behind a connection pool, leaks to whoever borrows the connection next.
 * So every query against the table has to run inside a transaction that set it
 * first, and this interface is the whole of that: one hook that owns "open a
 * transaction, apply the scope, hand back a delegate".
 *
 * 🛑 **ONE SETTING, AND THE ABSENCE OF THE SECOND IS THE POINT.** The snapshot
 * runner beside this one sets `age.client_id` as well. This one does not,
 * because `source_observations` has no `client_id` column and its policy reads
 * only the organisation (ADR-0062 D1: an observation is scoped by whose
 * business it is about; a client is a SUBJECT, never a principal). 🚫 Do not
 * "align" the two runners by adding the client setting here — the column it
 * would scope against does not exist, and adding it would be the first half of
 * adding the column.
 *
 * 🚫 **THIS IS NOT AUTHORIZATION** (ADR-0046 D5, ADR-0069). The policy checks
 * the row against the scope the transaction ASKED for, never against an
 * entitlement to that scope. The boundary is that the scope came from the
 * operator's client record; this is the coherence check underneath it.
 *
 * ⚠️ **WHY NOT WIDEN `SourceObservationDelegate`.** Putting a transaction method
 * on the delegate would move connection management into the shape used to read
 * and write rows, and every test double would then have to model transactions.
 * Kept separate, the delegate stays exactly as narrow as it was: still no
 * `update`, no `delete`, no `upsert`, still no `findUnique`.
 *
 * 🚫 **NO `@prisma/client` IMPORT.** Same construction as the delegate: the two
 * interfaces below are satisfied structurally by a real `PrismaClient`, so this
 * package keeps typechecking with zero generated code and zero database.
 */

import type { SourceObservationDelegate } from './source-observation-delegate';

/**
 * The scope a transaction runs under.
 *
 * ⚠️ ONE FIELD, and it is the caller's `organizationId` — taken off the
 * operator's client record, 🚫 never read out of an observation's own payload.
 * A row that could name the scope it is stored under would be a row that
 * authorises itself.
 */
export interface SourceObservationScope {
  readonly organizationId: string;
}

export interface SourceObservationScopeRunner {
  /**
   * Runs `operation` inside a single transaction in which the scope setting has
   * been applied. The delegate handed to `operation` must be bound to that same
   * transaction — one from another connection would run outside the scope and
   * fail closed.
   */
  runInScope<T>(
    scope: SourceObservationScope,
    operation: (observations: SourceObservationDelegate) => Promise<T>,
  ): Promise<T>;
}

/**
 * The narrowest view of a transaction-bound client this runner needs.
 *
 * `$executeRaw` is declared in its tagged-template form on purpose: that form
 * makes `${scope.organizationId}` a **bound parameter** rather than text
 * spliced into SQL. 🚫 `$executeRawUnsafe` is deliberately absent — what is not
 * offered cannot be reached for.
 */
export interface SourceObservationScopeTransaction {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  readonly sourceObservation: SourceObservationDelegate;
}

/**
 * The narrowest view of a client capable of opening one.
 *
 * 🚫 No `$connect`, no `$disconnect`, no `$queryRaw`, no `$executeRawUnsafe`,
 * and no model access outside a transaction — so this runner cannot issue an
 * unscoped query even by mistake.
 */
export interface SourceObservationTransactionSource {
  $transaction<T>(operation: (tx: SourceObservationScopeTransaction) => Promise<T>): Promise<T>;
}

/**
 * The production implementation.
 *
 * `set_config(name, value, true)` is `SET LOCAL` in function form: identical
 * transaction-local lifetime, but it accepts the value as a bound parameter,
 * which `SET LOCAL` cannot.
 *
 * 🚫 No clock, no randomness, no id generation, no environment access, no
 * connection management. A rejected transaction propagates unchanged — this
 * layer has no basis to classify a database error, and inventing a taxonomy
 * here is what ADR-0036 D8 refused.
 */
export class PrismaSourceObservationScopeRunner implements SourceObservationScopeRunner {
  private readonly source: SourceObservationTransactionSource;

  constructor(source: SourceObservationTransactionSource) {
    this.source = source;
  }

  async runInScope<T>(
    scope: SourceObservationScope,
    operation: (observations: SourceObservationDelegate) => Promise<T>,
  ): Promise<T> {
    return this.source.$transaction(async (tx) => {
      // Always, before anything reads or writes. 🚫 There is no flag to omit
      // it: an unscoped transaction is not a degraded mode, it is one the
      // policy rejects, and offering the option would make that reachable from
      // production.
      await tx.$executeRaw`SELECT set_config('age.organization_id', ${scope.organizationId}, true)`;

      // ⚠️ The delegate MUST come off `tx`, never off the source. One from
      // another connection would run outside this transaction, where the
      // setting does not apply, and fail closed — the correct outcome, but an
      // exceptionally confusing way to discover the bug.
      return operation(tx.sourceObservation);
    });
  }
}
