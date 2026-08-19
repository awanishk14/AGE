/**
 * `@age/session-store` — ADR-0061 **A2**'s rules, and nothing that performs them.
 *
 * 🚫 **IT STORES NOTHING, DESPITE THE NAME.** It opens no database, mints no
 * token, reads no clock and verifies no credential. It is the SHAPE of a session
 * row and the decisions that make an unusable one impossible to mistake for a
 * usable one. Persisting the rows is the next slice; minting a token is an
 * effect and belongs to a composition root.
 *
 * 🚫 **A SESSION IS NOT AN `OperatorPrincipal`** (ADR-0053 D4, ADR-0058 D1), and
 * 🚫 **carries no role, no `isAdmin` and no permission list** (ADR-0062 D3).
 * Admin is never a bypass, and a flag on a session is how a bypass arrives.
 *
 * 🚫 **NOTHING HERE IS AN AUTHORIZATION.** A usable session says who is asking,
 * never what they may do — that is `askEntitlement` (A3).
 */

export {
  assessSession,
  assertSessionTokenShape,
  hashSessionToken,
  SESSION_TOKEN_HEX_LENGTH,
  SessionRefusedError,
  SessionStoreRefusedError,
  sessionTokenHashesMatch,
  type SessionAssessment,
  type SessionPrincipal,
  type SessionRecord,
  type VerifiedPlatformSession,
  type VerifiedSession,
} from './session-record';

export { normalizeSessionRecord } from './session-row';

/**
 * 🛑 **VERIFICATION IS NOT ISSUANCE** (ADR-0068 §0.1b). The lookup is injected,
 * so this package still opens no database and still mints nothing.
 */
export {
  verifyPresentedSessionToken,
  type PresentedTokenVerification,
  type SessionVerification,
} from './session-verification';

export {
  ISSUED_SESSION_LIFETIME_SECONDS,
  MAXIMUM_SESSION_LIFETIME_SECONDS,
  MINIMUM_SESSION_LIFETIME_SECONDS,
  sessionExpiryFrom,
} from './session-lifetime';

/**
 * 🛑 **ADR-0079 §3 CORRECTED THIS PACKAGE'S HEADER: A SESSION MAY NOW BE
 * ISSUED.** The header above says "minting a token is an effect and belongs to
 * a composition root", and that is 🚫 NOT relaxed — the token still arrives as
 * a parameter and this package still has no randomness, no clock and no
 * database. What changed is that the SHAPE of an issued row now exists here,
 * where the expiry ceiling and the digest already live, so that no caller can
 * assemble a session that skipped either.
 *
 * 🚫 **ISSUING A SESSION IS NOT PROVISIONING AN ACCOUNT.** ADR-0079 overturned
 * one refusal, and the `accounts` table holds `GRANT SELECT` alone.
 */
export {
  issuedSessionRecord,
  platformIssuedSessionRecord,
  type PlatformSessionIssuanceRequest,
  type SessionIssuanceRequest,
} from './session-issuance';
