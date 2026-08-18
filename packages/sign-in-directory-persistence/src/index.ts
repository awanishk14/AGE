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

export { signInDirectoryRead } from './directory-read';
