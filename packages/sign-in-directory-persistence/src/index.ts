/**
 * `@age/sign-in-directory-persistence` — the durable READ behind `decideSignIn`
 * (ADR-0079 slice 3).
 *
 * 🛑 **READ-ONLY BY CONSTRUCTION.** Both delegates carry find methods and
 * nothing else, matching `GRANT SELECT` and nothing else on `accounts` and
 * `account_memberships`. 🛑 **AGE MINTS NOTHING**: this package can read who
 * exists; 🚫 it cannot bring anyone into existence, and the database would
 * refuse it if it tried.
 *
 * 🚫 **IT DECIDES NOTHING.** Admission is `@age/sign-in-directory`'s answer,
 * always, and afterwards.
 *
 * It shares the single Prisma schema of record —
 * `packages/persistence/src/prisma/schema.prisma` (ADR-0031 D3) — and declares
 * no schema of its own.
 */

export type {
  DirectoryAccountDelegate,
  DirectoryAccountWhere,
  DirectoryMembershipDelegate,
} from './directory-delegates';

export {
  PrismaDirectoryScopeRunner,
  type DirectoryDelegates,
  type DirectoryScope,
  type DirectoryScopeRunner,
  type DirectoryScopeTransaction,
  type DirectoryTransactionSource,
} from './directory-scope-runner';

export { directoryEntryByAccountRead, signInDirectoryRead } from './directory-read';

/**
 * ADR-0080 OPTION A — the platform read, and 🚫 **NOT a second directory**.
 *
 * ⚠️ **IT IS FENCED BY THE GOOGLE-VERIFIED ADDRESS, 🚫 NOT "unscoped".** The
 * database answers exactly one question — *is this ONE address, which the
 * caller already holds, a platform operator?* 🚫 It cannot enumerate, and 🚫 it
 * cannot be pointed at a tenant.
 *
 * 🛑 **IT DECIDES NOTHING AND ISSUES NOTHING**, exactly like the scoped read.
 */
export {
  PrismaPlatformDirectoryRunner,
  platformDirectoryRead,
  type PlatformDirectoryRunner,
  type PlatformTransactionSource,
} from './platform-directory-read';

/**
 * ADR-0089 OPTION D — the same fence, keyed by the **account id a session
 * already proved**, so a platform membership revoked mid-session is caught on
 * the NEXT REQUEST rather than at eight-hour expiry.
 *
 * 🛑 **A SECOND KEY, 🚫 NOT A WIDER DOOR.** It answers exactly one question —
 * *does THIS account, whose session I am already holding, still hold a live
 * platform membership?* 🚫 It cannot enumerate, 🚫 it cannot be pointed at a
 * tenant, and it fails **closed** when its setting is absent.
 *
 * ⚠️ **ITS CALLER IS THE SCOPE DOOR, 🚫 NOT THE SIGN-IN DOOR.** The sign-in door
 * can INSERT a session; a per-request read must never travel through one that
 * can mint a credential.
 */
export {
  PrismaPlatformAccountRunner,
  platformDirectoryReadByAccount,
  type PlatformAccountRunner,
  type PlatformAccountTransactionSource,
} from './platform-account-read';
