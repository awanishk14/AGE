import { MAXIMUM_SESSION_LIFETIME_SECONDS } from '@age/session-store';

/**
 * ADR-0061 **A6 item 3** — how the session reference travels, and 🛑 **what a
 * browser must refuse to do with it.**
 *
 * ⚠️ **THE COOKIE IS A REFERENCE, NOT A CLAIM.** It carries the opaque token and
 * 🚫 nothing else — no organization, no account, no role, no expiry the client
 * could edit. Every fact about the session lives in the row the token points at,
 * where the operator can revoke it. A cookie that carried facts would be a
 * cookie a client could forge facts into.
 *
 * The four attributes, and what each one actually stops:
 *
 * - **`HttpOnly`** — script cannot read it. A single XSS anywhere in the console
 *   would otherwise be a session exfiltration, silently and permanently.
 * - **`Secure`** — it is never sent over plaintext HTTP, so a network between
 *   the operator and the VPS never sees it. This is the cookie half of A6 item 1;
 *   the TLS half is the deployment's.
 * - **`SameSite=Strict`** — another site's page cannot cause a request that
 *   carries it. The console has no inbound links from anywhere, so the usability
 *   cost of `Strict` over `Lax` is zero and it also covers top-level GET.
 * - **`Path=/`, no `Domain`** — the cookie belongs to exactly one origin. A
 *   `Domain` attribute would share it with every subdomain, including one
 *   somebody else operates one day.
 *
 * ⚠️ **THE NAME CARRIES THE `__Host-` PREFIX ON PURPOSE.** It is the one part of
 * this the BROWSER enforces rather than trusting the server: a `__Host-` cookie
 * is rejected outright unless it is `Secure`, `Path=/` and has no `Domain`. If a
 * later change drops `Secure`, the cookie stops working instead of silently
 * becoming insecure — a mistake that fails loudly rather than quietly.
 *
 * 🛑 **CLEARING THE COOKIE IS NOT REVOCATION.** An expired cookie is a request
 * the browser stops making; the token in it stays valid until the row says
 * otherwise. Server-side revocation is `@age/session-store`'s `revokedAt`, and
 * 🚫 nothing in this module may be described as ending a session.
 *
 * Pure: 🚫 it reads no clock, sets no header and touches no request.
 */

/** 🚫 Never carries the token — a refusal is a message somebody will paste. */
export class SessionCookieRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionCookieRefusedError';
  }
}

/**
 * ⚠️ The `__Host-` prefix is a browser-enforced invariant, not decoration.
 * 🚫 Do not rename this to something friendlier.
 */
export const SESSION_COOKIE_NAME = '__Host-age_session';

/** 🚫 Not configurable. Each one is refused by the browser or by us, never both. */
export const SESSION_COOKIE_ATTRIBUTES = Object.freeze([
  'Path=/',
  'HttpOnly',
  'Secure',
  'SameSite=Strict',
] as const);

/** A token may only be the opaque hex reference the session store recognises. */
const OPAQUE_TOKEN = /^[0-9a-f]{64}$/;

/**
 * The `Set-Cookie` value that issues a session.
 *
 * @throws {SessionCookieRefusedError} for a token that is not the opaque
 *         reference, or a lifetime outside the session ceiling.
 */
export function serializeSessionCookie(token: string, maxAgeSeconds: number): string {
  if (!OPAQUE_TOKEN.test(token)) {
    throw new SessionCookieRefusedError(
      'A session cookie may only carry the opaque session reference. This value is not one, and ' +
        'the refusal deliberately does not repeat it. A cookie that carried anything else — an ' +
        'organization, an account, an expiry — would be a fact the client could edit.',
    );
  }

  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 1) {
    throw new SessionCookieRefusedError(
      'A session cookie must expire at a whole number of seconds in the future. A cookie with no ' +
        'lifetime is a session cookie in the browser sense, which survives exactly as long as the ' +
        'browser feels like keeping it — which is not a policy.',
    );
  }

  if (maxAgeSeconds > MAXIMUM_SESSION_LIFETIME_SECONDS) {
    throw new SessionCookieRefusedError(
      `A session cookie must not outlive the session ceiling of ${MAXIMUM_SESSION_LIFETIME_SECONDS} ` +
        'seconds. A browser holding a reference longer than the row behind it can live is not more ' +
        'convenient — it is a login that appears to work and then does not.',
    );
  }

  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    ...SESSION_COOKIE_ATTRIBUTES,
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

/**
 * The `Set-Cookie` value that stops the browser sending the reference.
 *
 * 🛑 **THIS IS NOT A LOGOUT AND MUST NEVER BE PRESENTED AS ONE.** It ends the
 * browser's habit, not the session. A caller that clears the cookie without also
 * recording `revokedAt` has left a working token in whatever copied it.
 */
export function expireSessionCookie(): string {
  return [`${SESSION_COOKIE_NAME}=`, ...SESSION_COOKIE_ATTRIBUTES, 'Max-Age=0'].join('; ');
}

/**
 * The token a request offers, if it offers one that could be a token at all.
 *
 * ⚠️ Returns `undefined` rather than throwing: an absent or malformed cookie is
 * an ordinary anonymous request, 🚫 not an error condition. Whether the token
 * names a usable session is `assessSession`'s answer, never this one's.
 */
export function readSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (cookieHeader === undefined) return undefined;

  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;

    const name = pair.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;

    const value = pair.slice(separator + 1).trim();
    return OPAQUE_TOKEN.test(value) ? value : undefined;
  }

  return undefined;
}
