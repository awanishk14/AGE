import type { DirectoryAccountDelegate, DirectoryMembershipDelegate } from './directory-delegates';

/**
 * The transaction boundary the directory tables require (ADR-0079 slice 2's
 * policies, on the ADR-0033 D7 pattern).
 *
 * 🛑 **WHY THIS IS NOT `PrismaOperatorSessionScopeRunner`.** That runner hands
 * the operation `tx.operatorSession` — one delegate, named in its body. This
 * read needs TWO delegates off the SAME transaction, because the account read
 * and the membership read must run under one `set_config` or the policies
 * disagree about which scope they are answering for. Parameterising the session
 * runner to return a pair would widen a module whose entire argument is that it
 * reaches exactly one table. 🚫 So it is untouched, and this one is separate.
 *
 * 🛑 **THE SCOPE IS UNAVOIDABLE, AND FAILING CLOSED IS A FEATURE.** Both
 * policies compare against `NULLIF(current_setting('age.organization_id', true), '')`,
 * so an unscoped transaction reads NOTHING — which sign-in would report as "no
 * account", a refusal indistinguishable from a stranger. The organization is
 * therefore REQUIRED, and 🚫 there is no "all organizations" value.
 *
 * ⚠️ **AND `accounts` IS VISIBLE ONLY THROUGH A LIVE MEMBERSHIP.** Its policy is
 * an `EXISTS` over `account_memberships` requiring `revoked_at IS NULL` in this
 * scope. So the DEPLOYED read cannot always distinguish "nobody provisioned this
 * person" from "their membership was revoked" — a revoked-only account reads as
 * absent. `decideSignIn` still distinguishes them, because the distinction is
 * real and the policy is what collapses it; 🚫 this is stated rather than papered
 * over, and 🚫 the policy is NOT widened to recover the distinction.
 *
 * 🚫 **NO `@prisma/client` IMPORT**, and 🚫 no `$executeRawUnsafe`: what is not
 * offered cannot be reached for.
 */

/** ⚠️ ONE FIELD. A membership is scoped to an organization; 🚫 a client is a subject, never a principal. */
export interface DirectoryScope {
  readonly organizationId: string;
}

/** The two delegates, bound to one scoped transaction. */
export interface DirectoryDelegates {
  readonly accounts: DirectoryAccountDelegate;
  readonly memberships: DirectoryMembershipDelegate;
}

export interface DirectoryScopeRunner {
  runInScope<T>(
    scope: DirectoryScope,
    operation: (delegates: DirectoryDelegates) => Promise<T>,
  ): Promise<T>;
}

/** The narrowest view of a transaction-bound client this runner needs. */
export interface DirectoryScopeTransaction {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  readonly account: DirectoryAccountDelegate;
  readonly accountMembership: DirectoryMembershipDelegate;
}

/** The narrowest view of a client capable of opening one. */
export interface DirectoryTransactionSource {
  $transaction<T>(operation: (tx: DirectoryScopeTransaction) => Promise<T>): Promise<T>;
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
 * 🚫 No clock, no randomness, no id generation, no environment access.
 */
export class PrismaDirectoryScopeRunner implements DirectoryScopeRunner {
  private readonly source: DirectoryTransactionSource;

  constructor(source: DirectoryTransactionSource) {
    this.source = source;
  }

  async runInScope<T>(
    scope: DirectoryScope,
    operation: (delegates: DirectoryDelegates) => Promise<T>,
  ): Promise<T> {
    return this.source.$transaction(async (tx) => {
      // Always, before anything reads. 🚫 There is no flag to omit it.
      await tx.$executeRaw`SELECT set_config('age.organization_id', ${scope.organizationId}, true)`;

      // ⚠️ BOTH delegates come off `tx`, never off the source — one from another
      // connection would run outside this transaction, where the setting does
      // not apply, and fail closed.
      return operation({ accounts: tx.account, memberships: tx.accountMembership });
    });
  }
}
