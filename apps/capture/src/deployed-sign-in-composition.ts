import { PrismaClient } from '@prisma/client';
import {
  operatorSessionIssuance,
  type IssuedSession,
  type OperatorSessionIssuanceDelegate,
} from '@age/session-issuance-persistence';
import { PrismaOperatorSessionScopeRunner } from '@age/session-store-persistence';
import type { SessionIssuanceRequest } from '@age/session-store';
import {
  PrismaDirectoryScopeRunner,
  signInDirectoryRead,
} from '@age/sign-in-directory-persistence';
import type { DirectoryEntry } from '@age/sign-in-directory';

import {
  judgeDeployedDatabase,
  type DeployedConnectionOptions,
} from './deployed-console-composition';

/**
 * The **deployed sign-in** composition root — ADR-0079 §6 slice 3.
 *
 * 🛑 **A THIRD FILE, AND FOR THE SAME REASON THE SECOND ONE EXISTS.**
 * `deployed-console-composition.ts` claims *"exactly two doors and both only
 * READ"*; `deployed-session-composition.ts` claims it can read one session row
 * and set `revokedAt` on one, and 🚫 nothing else. Both of those sentences are
 * still true, and they stay true because the INSERT ADR-0079 §3 authorized is
 * composed here instead of being added to either of them. ⚠️ A claim that has to
 * be amended to "…except one" is a claim nobody can check.
 *
 * This door's own claim, and it is the whole of it:
 *
 *   **It can read one account and that account's memberships, and it can insert
 *   one `operator_sessions` row. It can do nothing else, to nothing else.**
 *
 * 🛑 **ISSUANCE IS NOT PROVISIONING.** `accounts` and `account_memberships` hold
 * `GRANT SELECT` and nothing else, so this door can start a session for a person
 * who already exists and 🚫 cannot bring one into existence. **AGE MINTS
 * NOTHING** survives slice 3 intact: what ADR-0079 overturned is the refusal on
 * issuing SESSIONS, and 🚫 nothing else.
 *
 * 🚫 **IT TOUCHES NO CLIENT DATA AT ALL** — no snapshot, no observation, no BIF,
 * no client record.
 *
 * ⚠️ **THE A5 JUDGEMENT IS IMPORTED, 🚫 NOT REIMPLEMENTED**, exactly as next
 * door: same check, same resolution, same refusals, same placement above
 * `new PrismaClient(`.
 *
 * 🚫 **NO CLOCK, NO RANDOMNESS AND NO GOOGLE.** The token, the issuing instant
 * and the verified identity all arrive as parameters. Minting and fetching are
 * effects, and they belong to `apps/studio`'s ONE effect module.
 */

export type { IssuedSession };

/**
 * The sign-in store, narrowed to the two operations admission needs.
 *
 * ⚠️ **BOTH TAKE THE ORGANIZATION EXPLICITLY, AND NEITHER DEFAULTS IT.** The
 * directory policies fail closed on an unscoped read — which sign-in would
 * report as "no such account", a refusal indistinguishable from a stranger — and
 * the `FOR INSERT … WITH CHECK` policy REFUSES an unscoped insert outright.
 */
export interface SignInStoreConnection {
  /** ⚠️ One address, inside one scope. 🚫 There is no way to ask for a list. */
  readonly findDirectoryEntry: (organizationId: string, email: string) => Promise<DirectoryEntry>;
  /** 🛑 The ONE authorized INSERT. ⚠️ The token was minted by the caller and is hashed downstream. */
  readonly issue: (
    organizationId: string,
    request: SessionIssuanceRequest,
  ) => Promise<IssuedSession>;
  readonly close: () => Promise<void>;
}

/**
 * Opens the sign-in door.
 *
 * ⚠️ Two runners over ONE client, because the two are different types on
 * purpose: the directory runner hands out find-only delegates for `accounts` and
 * `account_memberships`, and the issuance runner hands out a delegate carrying
 * `create` alone. 🚫 Neither can perform the other's work, and 🚫 there is no
 * third that carries both.
 */
export function openDeployedPrismaSignInConnection(
  options: DeployedConnectionOptions,
): SignInStoreConnection {
  const composition = judgeDeployedDatabase(options);

  const client = new PrismaClient({ datasources: { db: { url: composition.url } } });

  const directoryRunner = new PrismaDirectoryScopeRunner(client);
  const issuanceRunner = new PrismaOperatorSessionScopeRunner<OperatorSessionIssuanceDelegate>(
    client,
  );

  return {
    findDirectoryEntry: (organizationId, email) =>
      signInDirectoryRead(directoryRunner, { organizationId })(email),
    issue: (organizationId, request) =>
      operatorSessionIssuance(issuanceRunner, { organizationId })(request),
    close: () => client.$disconnect(),
  };
}
