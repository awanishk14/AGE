/**
 * `@age/session-issuance-persistence` — **the one place a session begins**
 * (ADR-0079 §3, slice 2 of §6).
 *
 * 🛑 **THE PACKAGE IS ONE ACT WIDE, DELIBERATELY.** It exports a single
 * function and a single delegate that offers `create` and nothing else. There
 * is no read here (that is `@age/session-store-persistence`), no revocation
 * (that is its revocation module), and no provisioning of accounts or
 * memberships anywhere — those tables hold `GRANT SELECT` alone, because
 * ADR-0079 overturned the refusal on issuing SESSIONS and 🚫 nothing else.
 *
 * 🚫 **IT HAS NO CALLER YET, AND THAT IS SLICE 3'S JOB.** Sign-in is where a
 * token is minted and this is invoked; until then the deployed console stays
 * deliberately unreachable, and 🚫 planting a session row is not a way around
 * that.
 *
 * It shares the single Prisma schema of record —
 * `packages/persistence/src/prisma/schema.prisma` (ADR-0031 D3) — and declares
 * no schema of its own.
 */

export {
  operatorSessionIssuance,
  platformOperatorSessionIssuance,
  SessionIssuanceRefusedError,
  type IssuedSession,
  type OperatorSessionIssuanceDelegate,
} from './operator-session-issuance';
