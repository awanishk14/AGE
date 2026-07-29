/**
 * The first production implementation of `ScoredBifSnapshotScopeRunner`
 * (ADR-0043 D6, Slice A).
 *
 * WHAT IT IS. The whole of ADR-0033 D7's practical consequence: open one
 * transaction, apply both scope settings to it, hand the operation a delegate
 * bound to that same transaction. Nothing more. It is the piece without which
 * `ScopedScoredBifSnapshotRepository` cannot be constructed, and therefore the
 * piece without which the durable path cannot run at all under
 * `FORCE ROW LEVEL SECURITY` — every INSERT as a non-owner role would be
 * rejected by the policy's `WITH CHECK` predicate.
 *
 * WHY IT LIVES HERE AND NOT AT A COMPOSITION ROOT. The interface's own doc
 * comment says the implementation "lives at the composition root, which is the
 * only place that has a client to open a transaction on". That was true when
 * ADR-0033 was written, and it is the reason this file takes its transaction
 * source as a *parameter* instead of constructing one. The runner needs a
 * client; it does not need to own one. Placing it beside the port it satisfies
 * makes it independent of which caller arrives — CLI, HTTP or batch all need
 * exactly this, and an implementation parked inside an app would be rewritten
 * the first time a second caller appeared (ADR-0043 D9).
 *
 * WHY NO `@prisma/client` IMPORT. Same reason `ScoredBifSnapshotDelegate` is
 * declared structurally: `@prisma/client` exposes nothing until
 * `prisma generate` has run, so importing it here would make this package's
 * typecheck and build depend on a generation step. ADR-0043 D6 authorizes that
 * step for `ci.yml` in Slice B, at the composition root, where the generated
 * client must finally be named. It does not authorize dragging the dependency
 * down into a package that does not need it. The two narrow interfaces below
 * are satisfied structurally by a real `PrismaClient`, and the live suite
 * proves that by assignment rather than by assertion.
 *
 * WHAT IT DOES NOT DO. No clock, no randomness, no id generation, no
 * environment access, no connection management. It does not open, close,
 * configure or dispose of a client, and it never reaches for one ambiently.
 * Failure handling is deliberately absent: a rejected transaction propagates
 * unchanged, because this layer has no basis to classify a database error and
 * inventing a taxonomy here is exactly what ADR-0036 D8 refused.
 */

import type { ScoredBifSnapshotDelegate } from './scored-bif-snapshot-delegate';
import type {
  ScoredBifSnapshotScope,
  ScoredBifSnapshotScopeRunner,
} from './scored-bif-snapshot-scope-runner';

/**
 * The narrowest view of a transaction-bound client this runner needs.
 *
 * `$executeRaw` is declared in its tagged-template form on purpose. That form
 * is what makes `${scope.clientId}` a **bound parameter** rather than text
 * spliced into SQL, so a scope id — the one value here that comes from outside
 * — can never be concatenated into a statement. A string-accepting `$executeRawUnsafe`
 * is deliberately absent from this interface: what is not offered cannot be
 * reached for.
 */
export interface ScoredBifSnapshotScopeTransaction {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  readonly scoredBifSnapshot: ScoredBifSnapshotDelegate;
}

/**
 * The narrowest view of a client capable of opening one.
 *
 * Note what is absent: no `$connect`, no `$disconnect`, no `$queryRaw`, no
 * `$executeRawUnsafe`, no model access outside a transaction. The runner is
 * handed the ability to open a scoped transaction and nothing else, so it
 * cannot issue an unscoped query even by mistake.
 */
export interface ScoredBifSnapshotTransactionSource {
  $transaction<T>(operation: (tx: ScoredBifSnapshotScopeTransaction) => Promise<T>): Promise<T>;
}

/**
 * The two settings the ADR-0033 policies read, in the form the policies expect.
 *
 * `set_config(name, value, true)` is `SET LOCAL` in function form: identical
 * transaction-local lifetime, but it accepts the value as a bound parameter,
 * which `SET LOCAL` cannot. Transaction-local is the requirement, not a
 * preference — a session-level setting outlives its work and, behind a
 * connection pool, leaks to whoever borrows the connection next.
 */
export class PrismaScoredBifSnapshotScopeRunner implements ScoredBifSnapshotScopeRunner {
  private readonly source: ScoredBifSnapshotTransactionSource;

  constructor(source: ScoredBifSnapshotTransactionSource) {
    this.source = source;
  }

  async runInScope<T>(
    scope: ScoredBifSnapshotScope,
    operation: (snapshots: ScoredBifSnapshotDelegate) => Promise<T>,
  ): Promise<T> {
    return this.source.$transaction(async (tx) => {
      // Both settings, always, before anything reads or writes. There is no
      // flag to omit one: a partially-scoped transaction is not a degraded
      // mode, it is a transaction the policy will reject, and offering the
      // option would only make that reachable from production.
      await tx.$executeRaw`SELECT set_config('age.client_id', ${scope.clientId}, true)`;
      await tx.$executeRaw`SELECT set_config('age.organization_id', ${scope.organizationId}, true)`;

      // The delegate MUST come off `tx`, not off the source. One from another
      // connection would run outside this transaction, where neither setting
      // applies, and fail closed — which is the correct outcome but an
      // exceptionally confusing way to discover the bug.
      return operation(tx.scoredBifSnapshot);
    });
  }
}
