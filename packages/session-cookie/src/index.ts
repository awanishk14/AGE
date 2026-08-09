/**
 * `@age/session-cookie` — ADR-0061 **A6 item 3**.
 *
 * 🚫 **THE COOKIE IS A REFERENCE, NOT A CLAIM.** It carries the opaque session
 * token and nothing else; every fact about the session lives in the row the
 * token points at, where the operator can revoke it.
 *
 * `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, no `Domain`, and the
 * `__Host-` name prefix — 🚫 none of them conditional on an environment.
 *
 * 🛑 **CLEARING THE COOKIE IS NOT REVOCATION** and 🚫 must never be presented as
 * one. Server-side revocation is `@age/session-store`'s `revokedAt`.
 *
 * Pure: 🚫 it sets no header, reads no request and touches no clock. It has no
 * caller — wiring it is the deployment composition's slice.
 */

export {
  expireSessionCookie,
  readSessionCookie,
  SESSION_COOKIE_ATTRIBUTES,
  SESSION_COOKIE_NAME,
  SessionCookieRefusedError,
  serializeSessionCookie,
} from './session-cookie';
