/**
 * `@age/session-store-persistence` — the durable READ behind
 * `verifyPresentedSessionToken` (ADR-0068 §0.1b).
 *
 * 🛑 **SELECT-ONLY BY CONSTRUCTION.** The delegate this package declares carries
 * `findUnique` and nothing else, matching the `GRANT SELECT` the table holds and
 * the `FOR SELECT` policy with no `WITH CHECK`. 🚫 No `create`, no `update`, no
 * `upsert`, no `delete` — and 🚫 no `findMany`, because listing sessions is the
 * second-operator UI ADR-0068 §0.1c refuses by name.
 *
 * 🛑 **VERIFICATION IS NOT ISSUANCE.** AGE reads a credential it never issued.
 * The second operator's row is planted out of band, as an ACT, by someone
 * holding an owner connection. 🚫 There is no login route, no login screen, no
 * session-issuing endpoint and no provisioning surface anywhere in this
 * package's reach.
 *
 * 🚫 **NOTHING HERE IS AN AUTHORIZATION.** A verified session says WHO is
 * asking. What they may do is `askEntitlement`, always, afterwards — and RLS
 * underneath is coherence, never authorization (ADR-0046 D5).
 *
 * It shares the single Prisma schema of record —
 * `packages/persistence/src/prisma/schema.prisma` (ADR-0031 D3) — and declares
 * no schema of its own.
 */

export type {
  OperatorSessionDelegate,
  OperatorSessionLookupWhere,
} from './operator-session-delegate';

export {
  PrismaOperatorSessionScopeRunner,
  type OperatorSessionScope,
  type OperatorSessionScopeRunner,
  type OperatorSessionScopeTransaction,
  type OperatorSessionTransactionSource,
} from './operator-session-scope-runner';

export { operatorSessionLookup } from './operator-session-lookup';
