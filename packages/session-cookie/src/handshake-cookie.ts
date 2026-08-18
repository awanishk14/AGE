import { SessionCookieRefusedError } from './session-cookie';

/**
 * ADR-0079 slice 3 — **the two cookies that survive the trip to Google.**
 *
 * 🛑 **WHY THESE ARE `SameSite=Lax` WHEN THE SESSION COOKIE IS `Strict`, AND WHY
 * THAT IS NOT A RELAXATION.** The return from Google is a cross-site TOP-LEVEL
 * NAVIGATION, and a browser does not send a `SameSite=Strict` cookie on one. A
 * `Strict` handshake cookie is therefore not a stricter handshake — it is NO
 * handshake: `state` would be absent on every callback, and the only honest
 * response to an absent `state` is to refuse every sign-in. The session cookie
 * is untouched and stays `Strict`; 🚫 do not "make these consistent" with it.
 *
 * 🛑 **AND `Lax` IS STILL ENOUGH FOR WHAT THESE DEFEND.** They are read exactly
 * once, on one route, and compared against values that arrived in the URL. An
 * attacker who could cause the callback to be visited still cannot READ these
 * cookies (`HttpOnly`) and so cannot produce a `state` that matches one.
 *
 * ⚠️ **THEY EXPIRE IN TEN MINUTES, 🚫 NOT WITH THE SESSION.** They are alive
 * only for the seconds a human spends on Google's account chooser. A handshake
 * cookie that outlived that would be a replayable `nonce` sitting in a browser.
 *
 * 🛑 **THE CALLBACK MUST CLEAR THEM WHETHER IT SUCCEEDS OR REFUSES.** A `state`
 * left behind is a `state` that can be used twice, and a handshake usable twice
 * is not a handshake. `expireHandshakeCookies()` exists so no caller has to
 * remember two names.
 *
 * Pure: 🚫 no clock, no randomness, no header, no request. The values are minted
 * at `apps/studio`'s one effect module and arrive here as parameters.
 */

/** ⚠️ `__Host-` again: browser-enforced `Secure` + `Path=/` + no `Domain`. */
export const HANDSHAKE_STATE_COOKIE_NAME = '__Host-age_signin_state';

/** The nonce goes into the ID token; this is the copy AGE compares it against. */
export const HANDSHAKE_NONCE_COOKIE_NAME = '__Host-age_signin_nonce';

/**
 * 🚫 Not configurable, and 🚫 deliberately NOT the session attributes.
 * The one difference from `SESSION_COOKIE_ATTRIBUTES` is `SameSite`, and it is
 * the difference between a handshake that works and one that never fires.
 */
export const HANDSHAKE_COOKIE_ATTRIBUTES = Object.freeze([
  'Path=/',
  'HttpOnly',
  'Secure',
  'SameSite=Lax',
] as const);

/** Ten minutes: long enough to choose an account, short enough to be useless later. */
export const HANDSHAKE_COOKIE_MAX_AGE_SECONDS = 600;

/** The same shape the session token has — 32 bytes of hex, minted where randomness lives. */
const HANDSHAKE_VALUE = /^[0-9a-f]{64}$/;

/** What one sign-in attempt has to remember while the human is at Google. */
export interface SignInHandshake {
  readonly state: string;
  readonly nonce: string;
}

/**
 * The two `Set-Cookie` values that begin a sign-in.
 *
 * @throws {SessionCookieRefusedError} for a value that is not an opaque
 *         handshake reference. 🚫 The refusal never repeats the value.
 */
export function serializeHandshakeCookies(handshake: SignInHandshake): readonly string[] {
  return Object.freeze([
    handshakeCookie(HANDSHAKE_STATE_COOKIE_NAME, 'state', handshake.state),
    handshakeCookie(HANDSHAKE_NONCE_COOKIE_NAME, 'nonce', handshake.nonce),
  ]);
}

/**
 * The two `Set-Cookie` values that end one, 🛑 **successfully or not.**
 *
 * ⚠️ Clearing these IS meaningful, unlike clearing the session cookie: these
 * values live nowhere else, so the browser forgetting them is the whole of
 * their lifetime ending. That is the opposite of `expireSessionCookie`, whose
 * doc block says at length that it is not a logout.
 */
export function expireHandshakeCookies(): readonly string[] {
  return Object.freeze([
    [`${HANDSHAKE_STATE_COOKIE_NAME}=`, ...HANDSHAKE_COOKIE_ATTRIBUTES, 'Max-Age=0'].join('; '),
    [`${HANDSHAKE_NONCE_COOKIE_NAME}=`, ...HANDSHAKE_COOKIE_ATTRIBUTES, 'Max-Age=0'].join('; '),
  ]);
}

/**
 * The handshake a request carries back from Google, if it carries a whole one.
 *
 * 🛑 **ALL OR NOTHING.** A callback holding a `state` but no `nonce` cannot have
 * its ID token replay-checked, and the only safe reading of a half-present
 * handshake is that there is none. ⚠️ Returns `undefined` rather than throwing:
 * a stranger hitting the callback URL is an ordinary request, not an error.
 */
export function readHandshakeCookies(
  cookieHeader: string | undefined,
): SignInHandshake | undefined {
  const state = readCookie(cookieHeader, HANDSHAKE_STATE_COOKIE_NAME);
  const nonce = readCookie(cookieHeader, HANDSHAKE_NONCE_COOKIE_NAME);

  if (state === undefined || nonce === undefined) return undefined;

  return Object.freeze({ state, nonce });
}

function handshakeCookie(name: string, position: string, value: string): string {
  if (!HANDSHAKE_VALUE.test(value)) {
    throw new SessionCookieRefusedError(
      `A sign-in handshake cookie may only carry the opaque \`${position}\` reference, and this ` +
        'value is not one. The refusal names the position and never the value: a `state` in a log ' +
        'line is a `state` somebody else can present.',
    );
  }

  return [
    `${name}=${value}`,
    ...HANDSHAKE_COOKIE_ATTRIBUTES,
    `Max-Age=${HANDSHAKE_COOKIE_MAX_AGE_SECONDS}`,
  ].join('; ');
}

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (cookieHeader === undefined) return undefined;

  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== name) continue;

    const value = pair.slice(separator + 1).trim();
    return HANDSHAKE_VALUE.test(value) ? value : undefined;
  }

  return undefined;
}
