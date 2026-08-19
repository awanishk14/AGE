import type { DirectoryEntry } from '@age/sign-in-directory';

import type { DirectoryDelegates, DirectoryScopeTransaction } from './directory-scope-runner';
import { normalizeDirectoryEntry } from './directory-normalize';

/**
 * ADR-0080 (Accepted 2026-08-19, **OPTION A**) — **the fenced platform read.**
 *
 * 🛑 **THIS IS THE SECOND PATH TO THE SAME TWO TABLES, AND THIS REPOSITORY'S
 * WHOLE RECORD IS THAT THE SECOND PATH IS THE ONE THAT ROTS.** ADR-0080 §3 says
 * so about this very module before it existed. Everything below is the fence
 * that answer requires, and 🚫 none of it is decoration:
 *
 * - It is reachable from **exactly one caller**, the sign-in callback's
 *   composition door, pinned by full path in `tests/guards.spec.ts`.
 * - It runs **only after Google has verified an address**, and that address is
 *   its ONLY input. 🚫 There is no arm that takes an account id, and 🚫 no arm
 *   that takes nothing.
 * - It reads **two tables and no others** — 🚫 no snapshot, 🚫 no observation,
 *   🚫 no BIF, 🚫 no client, 🚫 no organization, 🚫 no session.
 * - It **writes nothing, to nothing, ever.** The delegates it is handed carry
 *   find methods only, and the database holds `GRANT SELECT` and nothing else.
 *   🛑 **AGE MINTS NOTHING**: this reads rows a human provisioned.
 *
 * 🛑 **IT IS 🚫 NOT "UNSCOPED". IT IS SCOPED BY THE VERIFIED ADDRESS.** Calling
 * it the unscoped reader — as ADR-0080 §3 did, before the shape was known —
 * invites the assumption that it can see everything if the caller omits
 * something, which is exactly how a read path rots. It cannot: the policies
 * added by `20260819000000_platform_membership_sign_in_read` expose rows only
 * while `age.platform_sign_in_email` is set, and `accounts` yields only the row
 * matching it. ⚠️ An empty or absent setting reads NOTHING — it fails CLOSED,
 * in the same direction as its tenant-scoped sibling.
 *
 * 🚫 **IT DECIDES NOTHING**, exactly as its sibling. It fetches rows;
 * `decideSignIn` reasons over them. A second, gentler copy of admission here is
 * how the two drift, and the copy that gets relaxed still passes its own tests.
 */

/**
 * The transaction boundary the platform read requires.
 *
 * 🛑 **A SEPARATE RUNNER, 🚫 NOT A FLAG ON `PrismaDirectoryScopeRunner`.** A
 * boolean parameter meaning "read without a tenant" is a boolean that can be
 * passed by mistake from the request path, and the mistake would be invisible:
 * the tenant read would simply start succeeding for rows it must never see.
 * ⚠️ Two runners cannot be confused for one another, because 🚫 neither can
 * express the other's `set_config`.
 */
export interface PlatformDirectoryRunner {
  runForVerifiedEmail<T>(
    email: string,
    operation: (delegates: DirectoryDelegates) => Promise<T>,
  ): Promise<T>;
}

/** The narrowest view of a client capable of opening one. */
export interface PlatformTransactionSource {
  $transaction<T>(operation: (tx: DirectoryScopeTransaction) => Promise<T>): Promise<T>;
}

/**
 * The production implementation.
 *
 * `set_config(name, value, true)` is `SET LOCAL` in function form — identical
 * transaction-local lifetime, but it takes the value as a BOUND PARAMETER, which
 * `SET LOCAL` cannot. ⚠️ That matters more here than anywhere else in this
 * repository: the value is an address that arrived from outside, and the only
 * reason it cannot be SQL is that it is never concatenated into any.
 *
 * ⚠️ Transaction-local also matters behind a pool — a session-level setting
 * outlives its work and leaks to whoever borrows the connection next, which here
 * would mean the NEXT request reading with a previous operator's address still
 * set.
 *
 * 🚫 No clock, no randomness, no id generation, no environment access.
 */
export class PrismaPlatformDirectoryRunner implements PlatformDirectoryRunner {
  private readonly source: PlatformTransactionSource;

  constructor(source: PlatformTransactionSource) {
    this.source = source;
  }

  async runForVerifiedEmail<T>(
    email: string,
    operation: (delegates: DirectoryDelegates) => Promise<T>,
  ): Promise<T> {
    return this.source.$transaction(async (tx) => {
      // Always, before anything reads. 🚫 There is no flag to omit it, and an
      // empty value reads nothing rather than everything.
      await tx.$executeRaw`SELECT set_config('age.platform_sign_in_email', ${email}, true)`;

      // 🛑 `age.organization_id` IS DELIBERATELY NOT SET HERE. Setting it would
      // put this transaction inside a tenant AS WELL, and the tenant policies
      // would OR their rows in — so a platform sign-in would read an agency's
      // people. The one thing this transaction must never become is both.
      return operation({ accounts: tx.account, memberships: tx.accountMembership });
    });
  }
}

/**
 * Builds the platform directory read the sign-in callback is fed from.
 *
 * ⚠️ **THE RETURNED FUNCTION TAKES THE ADDRESS AND NOTHING ELSE.** There is no
 * organization to bind, because a platform membership belongs to none — and 🚫
 * there is no parameter through which a caller could supply one.
 */
export function platformDirectoryRead(
  runner: PlatformDirectoryRunner,
): (email: string) => Promise<DirectoryEntry> {
  return (email: string): Promise<DirectoryEntry> =>
    runner.runForVerifiedEmail(email, (delegates) => normalizeDirectoryEntry(delegates, { email }));
}
