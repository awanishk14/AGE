import { PrismaClient } from '@prisma/client';
import {
  directoryEntryByAccountRead,
  PrismaDirectoryScopeRunner,
} from '@age/sign-in-directory-persistence';
import type { DirectoryEntry } from '@age/sign-in-directory';

import {
  judgeDeployedDatabase,
  type DeployedConnectionOptions,
} from './deployed-console-composition';

/**
 * The **deployed scope** composition root — ADR-0079 §6 slice 4.
 *
 * 🛑 **A FOURTH FILE, FOR THE SAME REASON THE THIRD ONE EXISTS.** Each door in
 * this directory carries ONE sentence about what it can do, and a sentence that
 * has to be amended to "…except one" is a sentence nobody can check. The sign-in
 * door next door can INSERT a session; re-deriving a signed-in operator's scope
 * happens on EVERY request, and 🚫 a per-request read must not travel through a
 * door that can mint a credential.
 *
 * This door's own claim, and it is the whole of it:
 *
 *   **It can read one account and that account's memberships. It writes
 *   NOTHING, to nothing, ever.**
 *
 * 🛑 **THIS IS WHY THE SCOPE IS NOT ON THE SESSION ROW.** ADR-0079 §2 property
 * 2: *the scope is read from the database on every request, 🚫 never from a
 * token claim* — so a demoted, revoked or disabled operator loses their reach on
 * the NEXT request rather than at token expiry. ⚠️ AGE already does exactly this
 * for `revokedAt`; this makes the membership agree with it. A `scope` column on
 * `operator_sessions` would be the cached authorization `@age/entitlement`
 * refuses by name — *a flag on the session is precisely how a bypass arrives*.
 *
 * 🚫 **IT TOUCHES NO CLIENT DATA AT ALL** — no snapshot, no observation, no BIF,
 * no client record. And 🚫 it decides nothing: `decideSignIn` reasons over the
 * rows, in a pure package, afterwards, and it is the SAME decision sign-in took.
 *
 * ⚠️ **THE A5 JUDGEMENT IS IMPORTED, 🚫 NOT REIMPLEMENTED**, exactly as its
 * three neighbours: same check, same resolution, same refusals, same placement
 * above `new PrismaClient(`.
 */

/**
 * The directory, narrowed to the one question a request may ask of it.
 *
 * ⚠️ **IT TAKES THE ORGANIZATION EXPLICITLY AND 🚫 DOES NOT DEFAULT IT.** The
 * directory policies fail closed on an unscoped read, which this boundary would
 * report as "no such account" — a refusal indistinguishable from a stranger's.
 * There is no call here you can make without saying which tenant you speak for.
 *
 * 🚫 **THERE IS NO WAY TO ASK FOR A LIST.** One account id, one entry. This door
 * cannot become a directory browser.
 */
export interface ScopeStoreConnection {
  readonly findDirectoryEntryByAccount: (
    organizationId: string,
    accountId: string,
  ) => Promise<DirectoryEntry>;
  readonly close: () => Promise<void>;
}

/**
 * Opens the scope door.
 *
 * ⚠️ ONE runner, carrying find-only delegates. 🚫 There is no second runner here
 * and no delegate that can write, so this function has no shape in which an
 * INSERT or an UPDATE could later be added without changing its type.
 */
export function openDeployedPrismaScopeConnection(
  options: DeployedConnectionOptions,
): ScopeStoreConnection {
  const composition = judgeDeployedDatabase(options);

  const client = new PrismaClient({ datasources: { db: { url: composition.url } } });

  const directoryRunner = new PrismaDirectoryScopeRunner(client);

  return {
    findDirectoryEntryByAccount: (organizationId, accountId) =>
      directoryEntryByAccountRead(directoryRunner, { organizationId })(accountId),
    close: () => client.$disconnect(),
  };
}
