/**
 * **THE ORGANIZATION A PLATFORM OPERATOR CHOSE TO WORK IN** — ADR-0085.
 *
 * 🛑 **THIS COOKIE IS A CHOICE, 🚫 NOT A CREDENTIAL, AND 🚫 NOT A FACT.** It
 * carries no authority whatsoever. It says only *which of the organizations
 * this console already serves the operator picked*, and the server re-checks
 * that value against its own list on **every single request** before it is
 * allowed to mean anything. A forged value names an organization the server
 * does not serve, and is discarded — so editing it buys nothing.
 *
 * 🛑 **IT IS THEREFORE NOT THE THING `session-cookie.ts` FORBIDS.** That module
 * refuses a cookie that carries *facts the client could edit* — an account, a
 * role, an expiry the server then believes. Nothing here is believed. The
 * session cookie still decides **who** is asking and whether they are a
 * platform principal; this one only narrows **where** an already-verified
 * platform principal asked to stand, among places the server independently
 * knows.
 *
 * ⚠️ **`SameSite=Lax`, and the reason is not convenience.** The session cookie
 * is `Strict` because it is a credential (ADR-0084 is the scar). This value is
 * not, and a `Strict` choice cookie withheld on a cross-site-initiated hop
 * would send the operator back to the picker after every sign-in — the exact
 * shape of defect ADR-0084 exists to remove. 🚫 This is not authority to
 * relax the SESSION cookie; ADR-0084 Option A remains unauthorized.
 *
 * Pure: 🚫 it reads no clock, sets no header and touches no request.
 */

/** ⚠️ `__Host-` again: browser-enforced `Secure` + `Path=/` + no `Domain`. */
export const ACTING_ORGANIZATION_COOKIE_NAME = '__Host-age_acting_organization';

/** 🚫 Not configurable. See the note above on `Lax`. */
export const ACTING_ORGANIZATION_COOKIE_ATTRIBUTES = Object.freeze([
  'Path=/',
  'HttpOnly',
  'Secure',
  'SameSite=Lax',
] as const);

/**
 * ⚠️ **A SHAPE CHECK IS 🚫 NOT AN AUTHORIZATION CHECK**, and this one is
 * deliberately weak on purpose: it exists so a malformed value never reaches a
 * comparison or a header, 🚫 not so that a well-formed one is trusted. The
 * comparison against the organizations this deployment actually serves is the
 * caller's, and it is not optional.
 */
const ORGANIZATION_ID = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** 🚫 Never carries the offered value — a refusal is a message somebody pastes. */
export class ActingOrganizationRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActingOrganizationRefusedError';
  }
}

/**
 * The `Set-Cookie` value that records the operator's choice.
 *
 * @throws {ActingOrganizationRefusedError} for a value that is not an
 *         organization identifier by shape, or a lifetime outside the session
 *         ceiling the caller was given.
 */
export function serializeActingOrganizationCookie(
  organizationId: string,
  maxAgeSeconds: number,
): string {
  if (!ORGANIZATION_ID.test(organizationId)) {
    throw new ActingOrganizationRefusedError(
      'That is not an organization identifier by shape, and the refusal deliberately does not ' +
        'repeat it. A value that cannot be an identifier must never reach a header, where a ' +
        'newline in it would be a second header.',
    );
  }

  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 1) {
    throw new ActingOrganizationRefusedError(
      'A choice must expire at a whole number of seconds in the future. ⚠️ It must not outlive ' +
        'the session that made it: a choice that survived a sign-out would be a stale answer ' +
        'waiting for the next person at the same browser.',
    );
  }

  return [
    `${ACTING_ORGANIZATION_COOKIE_NAME}=${organizationId}`,
    ...ACTING_ORGANIZATION_COOKIE_ATTRIBUTES,
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

/**
 * The `Set-Cookie` value that forgets the choice.
 *
 * ⚠️ 🚫 **THIS IS NOT A SIGN-OUT.** It forgets where the operator was standing;
 * the session is untouched, and the operator lands back on the picker.
 */
export function expireActingOrganizationCookie(): string {
  return [
    `${ACTING_ORGANIZATION_COOKIE_NAME}=`,
    ...ACTING_ORGANIZATION_COOKIE_ATTRIBUTES,
    'Max-Age=0',
  ].join('; ');
}

/**
 * The choice a request offers, if it offers one that could be one at all.
 *
 * ⚠️ Returns `undefined` for absent or malformed — an operator who has not
 * chosen yet is an ordinary case, 🚫 not an error. 🛑 **A returned value has
 * been checked for SHAPE and 🚫 nothing else.** The caller must compare it
 * against the organizations it serves before using it for anything.
 */
export function readActingOrganizationCookie(cookieHeader: string | undefined): string | undefined {
  if (cookieHeader === undefined) return undefined;

  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;

    const name = pair.slice(0, separator).trim();
    if (name !== ACTING_ORGANIZATION_COOKIE_NAME) continue;

    const value = pair.slice(separator + 1).trim();
    return ORGANIZATION_ID.test(value) ? value : undefined;
  }

  return undefined;
}
