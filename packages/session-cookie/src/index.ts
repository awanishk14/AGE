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

/**
 * 🛑 **ADR-0079 slice 3 — the two handshake cookies, and the ONE place in AGE
 * where `SameSite=Lax` is correct.** A browser does not send a `Strict` cookie
 * on the cross-site top-level navigation back from Google, so a `Strict`
 * handshake cookie is not a stricter handshake, it is none at all. 🚫 The
 * session cookie above is untouched and stays `Strict`.
 */
export {
  expireHandshakeCookies,
  HANDSHAKE_COOKIE_ATTRIBUTES,
  HANDSHAKE_COOKIE_MAX_AGE_SECONDS,
  HANDSHAKE_NONCE_COOKIE_NAME,
  HANDSHAKE_STATE_COOKIE_NAME,
  readHandshakeCookies,
  serializeHandshakeCookies,
  type SignInHandshake,
} from './handshake-cookie';
