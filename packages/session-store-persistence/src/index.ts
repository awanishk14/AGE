/**
 * `@age/session-store-persistence` — the durable READ behind
 * `verifyPresentedSessionToken` (ADR-0068 §0.1b).
 *
 * 🛑 **READ-ONLY BY CONSTRUCTION, PLUS EXACTLY ONE COLUMN OF ONE WRITE.** The
 * read delegate carries `findUnique` and nothing else. The revocation delegate
 * carries `updateMany` on `revokedAt` and nothing else, matching the
 * `GRANT UPDATE ("revoked_at")` the table holds. 🚫 No `create`, no `upsert`, no
 * `delete` — and 🚫 no `findMany`, because listing sessions is the
 * second-operator UI ADR-0068 §0.1c refuses by name.
 *
 * 🛑 **VERIFICATION IS NOT ISSUANCE.** AGE reads a credential it never issued.
 * The second operator's row is planted out of band, as an ACT, by someone
 * holding an owner connection. 🚫 There is no session-issuing endpoint and no
 * provisioning surface anywhere in this package's reach.
 *
 * ⚠️ **CORRECTED BY ADR-0074 §7 SLICE 2: THERE IS NOW A SIGN-IN SCREEN, AND IT
 * ISSUES NOTHING.** This header used to say there was no login route and no
 * login screen. `apps/studio` now has both — and what they do is present a token
 * an operator PASTED to `verifyPresentedSessionToken`, which is this same read.
 * Signing in is therefore verification with a cookie set as a consequence; 🚫 no
 * row is created by it, and the grants make sure none can be.
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

/**
 * 🛑 **ENDING A SESSION IS NOT STARTING ONE** (ADR-0074 §7 slice 2). The header
 * above says "no `update`", and it said so because the table held `GRANT SELECT`
 * alone. That is now `GRANT SELECT` plus `GRANT UPDATE ("revoked_at")` — a
 * COLUMN grant, added because ADR-0074 D3 requires a logout to write `revokedAt`
 * and *"a logout that only clears the cookie is not a logout"*.
 *
 * 🚫 **NOTHING ELSE MOVED.** There is still no INSERT, no DELETE, no `create`,
 * no `upsert` and no `findMany`; the read delegate is untouched and still
 * carries `findUnique` alone. AGE can end a session it never issued, and 🚫 it
 * still cannot issue one.
 */
export {
  operatorSessionRevocation,
  type OperatorSessionRevocationDelegate,
  type SessionRevocation,
} from './operator-session-revocation';
