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

/**
 * The scope a PLATFORM session runs under — ADR-0083 **D5**.
 *
 * 🛑 **THE FENCE IS THE DIGEST THE CALLER ALREADY HOLDS, AND THAT IS THE
 * WHOLE OF THE DESIGN.** A platform row has no organization, so there is no
 * tenant to narrow it by; `age.organization_id` would be a lie and an empty
 * string would be worse, because two absences comparing equal is the exact
 * shape ADR-0083 🚫 refused. The three additive policies added by
 * `20260819100000_…` therefore compare `token_hash` against
 * `age.platform_session_token_hash` — a setting a caller can only fill from a
 * credential it is already presenting.
 *
 * ⚠️ **IT NARROWS TO ONE ROW, 🚫 NEVER TO A SET.** A tenant scope selects an
 * organization's sessions; this selects the single row whose digest was handed
 * in. A caller holding one platform token cannot read, revoke or issue any other
 * platform session — 🚫 not even another of its own.
 *
 * 🚫 **THE RAW TOKEN NEVER APPEARS HERE.** The field is a digest, named as
 * one, exactly as `OperatorSessionLookupWhere.tokenHash` is.
 */
export interface PlatformSessionScope {
  readonly platformSessionTokenHash: string;
}

/**
 * The two scopes, as a discriminated union.
 *
 * 🛑 **THE UNION IS EXCLUSIVE BY CONSTRUCTION, 🚫 NOT BY DISCIPLINE.** There
 * is no shape carrying both, so 'set the organization AND the digest' is not a
 * transaction anyone can ask for — which is how D5's *never* is kept without a
 * runtime check that someone could later delete.
 */
export type SessionScope = OperatorSessionScope | PlatformSessionScope;

/**
 * ⚠️ **THE DELEGATE IS A TYPE PARAMETER, AND ITS DEFAULT IS THE READ ONE**
 * (ADR-0074 §7 slice 2). The transaction discipline — set the scope, then hand
 * over a delegate bound to that same transaction — is identical whether the work
 * inside is the verification read or the revocation write, and duplicating the
 * runner to say so twice would give the repository two places for the
 * `set_config` line to drift apart.
 *
 * 🚫 **PARAMETERISING THE DELEGATE DOES NOT WIDEN WHAT THE STORE CAN DO.** The
 * only two delegates that exist are `OperatorSessionDelegate` (`findUnique`
 * alone) and `OperatorSessionRevocationDelegate` (`updateMany` on `revokedAt`
 * alone), and the database grants `SELECT` plus `UPDATE ("revoked_at")` and
 * nothing else. A caller that supplied a wider delegate type would still be
 * rejected by PostgreSQL.
 */
export interface OperatorSessionScopeRunner<TDelegate = OperatorSessionDelegate> {
  /**
   * Runs `operation` inside a single transaction in which the scope setting has
   * been applied. The delegate handed to `operation` must be bound to that same
   * transaction — one from another connection would run outside the scope and
   * fail closed.
   */
  runInScope<T>(scope: SessionScope, operation: (sessions: TDelegate) => Promise<T>): Promise<T>;
}

/**
 * The narrowest view of a transaction-bound client this runner needs.
 *
 * `$executeRaw` is declared in its tagged-template form on purpose: that form
 * makes `${scope.organizationId}` a **bound parameter** rather than text spliced
 * into SQL.
 */
export interface OperatorSessionScopeTransaction<TDelegate = OperatorSessionDelegate> {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  readonly operatorSession: TDelegate;
}

/**
 * The narrowest view of a client capable of opening one.
 *
 * 🚫 No `$connect`, no `$disconnect`, no `$queryRaw`, no `$executeRawUnsafe`,
 * and no model access outside a transaction — so this runner cannot issue an
 * unscoped query even by mistake.
 */
export interface OperatorSessionTransactionSource<TDelegate = OperatorSessionDelegate> {
  $transaction<T>(
    operation: (tx: OperatorSessionScopeTransaction<TDelegate>) => Promise<T>,
  ): Promise<T>;
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
export class PrismaOperatorSessionScopeRunner<
  TDelegate = OperatorSessionDelegate,
> implements OperatorSessionScopeRunner<TDelegate> {
  private readonly source: OperatorSessionTransactionSource<TDelegate>;

  constructor(source: OperatorSessionTransactionSource<TDelegate>) {
    this.source = source;
  }

  async runInScope<T>(
    scope: SessionScope,
    operation: (sessions: TDelegate) => Promise<T>,
  ): Promise<T> {
    return this.source.$transaction(async (tx) => {
      // Always, before anything reads. 🚫 There is no flag to omit it: an
      // unscoped transaction is not a degraded mode, it is one the policy
      // rejects, and offering the option would make that reachable.
      //
      // 🛑 **ONE BRANCH, TWO SETTINGS, AND 🚫 NEVER BOTH** (ADR-0083 D5). The
      // `else` is the guarantee: a platform transaction that ALSO set
      // `age.organization_id` would satisfy the tenant policies as well, and the
      // digest fence would stop being a fence. ⚠️ Each setting is named on
      // exactly one line in the product, and a guard asserts that product-wide.
      if ('platformSessionTokenHash' in scope) {
        await tx.$executeRaw`SELECT set_config('age.platform_session_token_hash', ${scope.platformSessionTokenHash}, true)`;
      } else {
        await tx.$executeRaw`SELECT set_config('age.organization_id', ${scope.organizationId}, true)`;
      }

      // ⚠️ The delegate MUST come off `tx`, never off the source. One from
      // another connection would run outside this transaction, where the
      // setting does not apply, and fail closed — the correct outcome, but an
      // exceptionally confusing way to discover the bug.
      return operation(tx.operatorSession);
    });
  }
}
