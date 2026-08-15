import { PrismaClient } from '@prisma/client';
import {
  operatorSessionLookup,
  operatorSessionRevocation,
  PrismaOperatorSessionScopeRunner,
  type OperatorSessionRevocationDelegate,
  type SessionRevocation,
} from '@age/session-store-persistence';

import {
  judgeDeployedDatabase,
  type DeployedConnectionOptions,
} from './deployed-console-composition';

/**
 * The **deployed session** composition root — ADR-0074 §7 slice 2.
 *
 * 🛑 **ONE DOOR, AND ITS CLAIM IS DELIBERATELY NARROWER THAN ITS NEIGHBOUR'S.**
 * `deployed-console-composition.ts` says *"exactly two doors and both only
 * READ"*, and that sentence is the reason this file exists rather than a third
 * function over there: ADR-0074 D3 requires a logout to write `revokedAt`, and a
 * claim that has to be amended to "…except one" is a claim nobody can check.
 * This door's own claim is checkable and much smaller:
 *
 *   **It can read one session row by digest, and it can set `revokedAt` on one
 *   session row. It can do nothing else, to nothing else.**
 *
 * 🚫 **IT TOUCHES NO CLIENT DATA AT ALL.** No snapshot, no observation, no BIF,
 * no client record. `operator_sessions` holds the boundary itself, never the
 * things behind it, so this door being able to write does not mean a deployed
 * AGE can write a client's rows — that function still does not exist.
 *
 * 🛑 **REVOKING IS NOT ISSUING, AND THE DATABASE ENFORCES IT.** `age_app` holds
 * `GRANT SELECT` plus `GRANT UPDATE ("revoked_at")` — a COLUMN grant — and no
 * INSERT and no DELETE. Even a caller that reached the raw client below could
 * not create a session, extend one by moving `expires_at`, repoint one by
 * rewriting `token_hash`, or re-tenant one by rewriting `organization_id`.
 * ⚠️ **VERIFICATION IS NOT ISSUANCE therefore still holds, and it holds at the
 * layer that outlives this file.**
 *
 * ⚠️ **THE A5 JUDGEMENT IS IMPORTED, 🚫 NOT REIMPLEMENTED.** Same check, same
 * resolution, same refusals, same placement above `new PrismaClient(`. A second
 * copy is the "copy that gets relaxed still passes its own tests" shape A5
 * refuses by name.
 *
 * 🚫 **THIS IS NOT AN AUTHORIZATION** (ADR-0046 D5). It answers *does a row match
 * this digest in this scope*. What the resulting session may act on is
 * `askEntitlement`, always, afterwards.
 */

/**
 * The session store, narrowed to the two operations the boundary needs.
 *
 * ⚠️ **BOTH TAKE THE ORGANIZATION EXPLICITLY, AND NEITHER DEFAULTS IT.** Under
 * `FORCE ROW LEVEL SECURITY` an unscoped read returns zero rows and an unscoped
 * update touches zero rows — so a missing scope would look like a rejected
 * credential and like a successful logout respectively. Both are lies, and the
 * way they are prevented is that there is no call you can make without saying
 * which tenant you are speaking for.
 */
/**
 * ⚠️ Re-exported so a CALLER of this door can name the outcome without taking a
 * dependency on `@age/session-store-persistence` itself. 🚫 The point is not
 * convenience: a console that could import the persistence package directly
 * could construct its own runner over its own delegate, and the narrowing above
 * would stop being the only way in.
 */
export type { SessionRevocation };

export interface SessionStoreConnection {
  /** ⚠️ A DIGEST, 🚫 never a token. The hashing happened before this layer. */
  readonly findByTokenHash: (organizationId: string, tokenHash: string) => Promise<unknown>;
  /** Ends one session. ⚠️ `revokedAt` is a parameter — this holds no clock. */
  readonly revoke: (
    organizationId: string,
    sessionId: string,
    revokedAt: string,
  ) => Promise<SessionRevocation>;
  readonly close: () => Promise<void>;
}

/**
 * Opens the session door.
 *
 * ⚠️ Two runners over ONE client, because the two delegates are different types
 * on purpose: the read one carries `findUnique` alone, the write one carries
 * `updateMany` on `revokedAt` alone. 🚫 Neither can perform the other's work, and
 * 🚫 there is no third that carries both.
 */
export function openDeployedPrismaSessionConnection(
  options: DeployedConnectionOptions,
): SessionStoreConnection {
  const composition = judgeDeployedDatabase(options);

  const client = new PrismaClient({ datasources: { db: { url: composition.url } } });

  const readRunner = new PrismaOperatorSessionScopeRunner(client);
  const revokeRunner = new PrismaOperatorSessionScopeRunner<OperatorSessionRevocationDelegate>(
    client,
  );

  return {
    findByTokenHash: (organizationId, tokenHash) =>
      operatorSessionLookup(readRunner, { organizationId })(tokenHash),
    revoke: (organizationId, sessionId, revokedAt) =>
      operatorSessionRevocation(revokeRunner, { organizationId })(sessionId, revokedAt),
    close: () => client.$disconnect(),
  };
}
