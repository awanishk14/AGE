import type { DirectoryEntry } from '@age/sign-in-directory';

import type { DirectoryDelegates, DirectoryScopeTransaction } from './directory-scope-runner';
import { normalizeDirectoryEntry } from './directory-normalize';

/**
 * ADR-0089 (Accepted 2026-08-21, **OPTION D**) — **the account-keyed platform
 * read**, and the thing that makes _"the scope is read on every request"_ true
 * on the platform arm as well as the tenant one.
 *
 * 🛑 **THIS IS A THIRD PATH TO THE SAME TWO TABLES, AND THE RULE ABOUT SECOND
 * PATHS APPLIES TO IT UNCHANGED.** ADR-0080 §3 said the extra path is the one
 * that rots; the fence below is what that costs, and 🚫 none of it is decoration:
 *
 * - It is reachable from **exactly one caller**, the SCOPE composition door
 *   (🚫 not the sign-in door — that one can INSERT a session, and a per-request
 *   read must not travel through a door that can mint a credential).
 * - Its ONLY input is an **account id the session already proved**. 🚫 There is
 *   no arm that takes an organization, 🚫 no arm that takes an address, and 🚫 no
 *   arm that takes nothing.
 * - It reads **two tables and no others** — 🚫 no snapshot, 🚫 no observation,
 *   🚫 no BIF, 🚫 no client, 🚫 no organization, 🚫 no session.
 * - It **writes nothing, to nothing, ever.**
 *
 * 🛑 **IT IS 🚫 NOT "THE UNSCOPED READER". IT IS SCOPED BY THE PROVED ACCOUNT.**
 * The policies added by `20260821000000_platform_membership_request_reread`
 * expose rows only while `age.platform_sign_in_account` is set, and `accounts`
 * yields only the row matching it — **and only if that account still holds a
 * LIVE platform membership.** ⚠️ An empty or absent setting reads NOTHING. It
 * fails **closed**, in the same direction as both of its siblings.
 *
 * ⚠️ **A REVOKED MEMBERSHIP READS AS ABSENT, AND THAT IS THE FEATURE.** The
 * policy hides revoked rows, so the operator is refused on the next request. 🛑
 * The refusal collapses to _"unknown"_ rather than _"revoked"_ — the same
 * collapse the address-keyed policy already makes, named here rather than
 * papered over, and 🚫 the refusal a person sees is identical either way.
 *
 * 🚫 **IT DECIDES NOTHING.** It fetches rows; `decideSignIn` reasons over them,
 * in a pure package, afterwards, and it is the SAME decision sign-in took. A
 * second, gentler copy of admission here is how the two drift, and the copy that
 * gets relaxed still passes its own tests.
 */

/**
 * The transaction boundary the account-keyed read requires.
 *
 * 🛑 **A SEPARATE RUNNER, 🚫 NOT A FLAG ON EITHER SIBLING.** ADR-0080 already
 * gave the reason and it has not weakened: _"a boolean parameter meaning 'read
 * without a tenant' is a boolean that can be passed by mistake from the request
 * path, and the mistake would be invisible."_ ⚠️ Three runners cannot be
 * confused for one another, because 🚫 none can express another's `set_config`.
 */
export interface PlatformAccountRunner {
  runForProvedAccount<T>(
    accountId: string,
    operation: (delegates: DirectoryDelegates) => Promise<T>,
  ): Promise<T>;
}

/** The narrowest view of a client capable of opening one. */
export interface PlatformAccountTransactionSource {
  $transaction<T>(operation: (tx: DirectoryScopeTransaction) => Promise<T>): Promise<T>;
}

/**
 * The production implementation.
 *
 * `set_config(name, value, true)` is `SET LOCAL` in function form — identical
 * transaction-local lifetime, but it takes the value as a BOUND PARAMETER, which
 * `SET LOCAL` cannot. ⚠️ Transaction-local matters behind a pool: a
 * session-level setting outlives its work and leaks to whoever borrows the
 * connection next, which here would mean the NEXT request reading with a
 * previous operator's account still set.
 *
 * 🚫 No clock, no randomness, no id generation, no environment access.
 */
export class PrismaPlatformAccountRunner implements PlatformAccountRunner {
  private readonly source: PlatformAccountTransactionSource;

  constructor(source: PlatformAccountTransactionSource) {
    this.source = source;
  }

  async runForProvedAccount<T>(
    accountId: string,
    operation: (delegates: DirectoryDelegates) => Promise<T>,
  ): Promise<T> {
    return this.source.$transaction(async (tx) => {
      // Always, before anything reads. 🚫 There is no flag to omit it, and an
      // empty value reads nothing rather than everything.
      await tx.$executeRaw`SELECT set_config('age.platform_sign_in_account', ${accountId}, true)`;

      // 🛑 `age.organization_id` IS DELIBERATELY NOT SET HERE, and 🚫 neither is
      // `age.platform_sign_in_email`. Setting the first would put this
      // transaction inside a tenant AS WELL, and the tenant policies would OR
      // their rows in — so a platform request would read an agency's people.
      // The one thing this transaction must never become is both.
      return operation({ accounts: tx.account, memberships: tx.accountMembership });
    });
  }
}

/**
 * Builds the account-keyed platform read the SCOPE door is fed from.
 *
 * ⚠️ **THE RETURNED FUNCTION TAKES THE ACCOUNT ID AND NOTHING ELSE.** There is
 * no organization to bind, because a platform membership belongs to none — and
 * 🚫 there is no parameter through which a caller could supply one.
 */
export function platformDirectoryReadByAccount(
  runner: PlatformAccountRunner,
): (accountId: string) => Promise<DirectoryEntry> {
  return (accountId: string): Promise<DirectoryEntry> =>
    runner.runForProvedAccount(accountId, (delegates) =>
      normalizeDirectoryEntry(delegates, { accountId }),
    );
}
