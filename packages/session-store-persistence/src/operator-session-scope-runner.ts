import type { OperatorSessionDelegate } from './operator-session-delegate';

/**
 * The transaction boundary `operator_sessions` requires (ADR-0068 §0.1b, on the
 * ADR-0033 D7 pattern).
 *
 * 🛑 **THE POLICY MAKES THE SCOPE UNAVOIDABLE, AND THAT IS A FINDING, NOT AN
 * INCONVENIENCE.** `operator_sessions_select_in_scope` reads
 * `organization_id = NULLIF(current_setting('age.organization_id', true), '')`,
 * and it fails closed: a transaction that never set the scope sees no rows.
 * A verification that ran unscoped would therefore return "no such session" for
 * a perfectly good token — 🚫 a false refusal that looks exactly like a rejected
 * credential. So the organization is REQUIRED here, and a caller must say which
 * tenant it is presenting a token for.
 *
 * 🛑 **THE CLAIMED ORGANIZATION NARROWS; IT NEVER WIDENS.** The scope is what
 * the caller ASKED for, not what it is entitled to. A caller naming the wrong
 * organization matches no row and is unverified — it cannot reach another
 * tenant's session by naming that tenant, because the digest still has to match
 * a row that is already inside the named scope. And a verified session carries
 * its OWN `organizationId`, which is what `@age/entitled-read` re-derives the
 * query scope from (ADR-0062 D1) — 🚫 never the caller's claim.
 *
 * 🚫 **THIS IS NOT AUTHORIZATION** (ADR-0046 D5). RLS here is coherence. What
 * anyone may act on is `askEntitlement`, always, and afterwards.
 *
 * 🚫 **NO `@prisma/client` IMPORT**, and 🚫 no `$executeRawUnsafe`: what is not
 * offered cannot be reached for.
 */

/**
 * The scope a verification runs under.
 *
 * ⚠️ ONE FIELD, and 🚫 there is deliberately no `clientId`. A session belongs to
 * no client — it says who is asking, and a client is a SUBJECT, never a
 * principal (ADR-0062 D2). The column it would scope against does not exist.
 */
export interface OperatorSessionScope {
  readonly organizationId: string;
}

export interface OperatorSessionScopeRunner {
  /**
   * Runs `operation` inside a single transaction in which the scope setting has
   * been applied. The delegate handed to `operation` must be bound to that same
   * transaction — one from another connection would run outside the scope and
   * fail closed.
   */
  runInScope<T>(
    scope: OperatorSessionScope,
    operation: (sessions: OperatorSessionDelegate) => Promise<T>,
  ): Promise<T>;
}

/**
 * The narrowest view of a transaction-bound client this runner needs.
 *
 * `$executeRaw` is declared in its tagged-template form on purpose: that form
 * makes `${scope.organizationId}` a **bound parameter** rather than text spliced
 * into SQL.
 */
export interface OperatorSessionScopeTransaction {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  readonly operatorSession: OperatorSessionDelegate;
}

/**
 * The narrowest view of a client capable of opening one.
 *
 * 🚫 No `$connect`, no `$disconnect`, no `$queryRaw`, no `$executeRawUnsafe`,
 * and no model access outside a transaction — so this runner cannot issue an
 * unscoped query even by mistake.
 */
export interface OperatorSessionTransactionSource {
  $transaction<T>(operation: (tx: OperatorSessionScopeTransaction) => Promise<T>): Promise<T>;
}

/**
 * The production implementation.
 *
 * `set_config(name, value, true)` is `SET LOCAL` in function form: identical
 * transaction-local lifetime, but it accepts the value as a bound parameter,
 * which `SET LOCAL` cannot. Transaction-local matters behind a pool — a
 * session-level setting outlives its work and leaks to whoever borrows the
 * connection next.
 *
 * 🚫 No clock, no randomness, no id generation, no environment access, no
 * connection management. A rejected transaction propagates unchanged — this
 * layer has no basis to classify a database error (ADR-0036 D8).
 */
export class PrismaOperatorSessionScopeRunner implements OperatorSessionScopeRunner {
  private readonly source: OperatorSessionTransactionSource;

  constructor(source: OperatorSessionTransactionSource) {
    this.source = source;
  }

  async runInScope<T>(
    scope: OperatorSessionScope,
    operation: (sessions: OperatorSessionDelegate) => Promise<T>,
  ): Promise<T> {
    return this.source.$transaction(async (tx) => {
      // Always, before anything reads. 🚫 There is no flag to omit it: an
      // unscoped transaction is not a degraded mode, it is one the policy
      // rejects, and offering the option would make that reachable.
      await tx.$executeRaw`SELECT set_config('age.organization_id', ${scope.organizationId}, true)`;

      // ⚠️ The delegate MUST come off `tx`, never off the source. One from
      // another connection would run outside this transaction, where the
      // setting does not apply, and fail closed — the correct outcome, but an
      // exceptionally confusing way to discover the bug.
      return operation(tx.operatorSession);
    });
  }
}
