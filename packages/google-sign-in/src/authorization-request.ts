/**
 * `@age/google-sign-in` — ADR-0079 §6 **slice 3**, the pure half.
 *
 * 🛑 **THIS PACKAGE PERFORMS NO EFFECT AND IT IS THE POINT.** Signing in with
 * Google is three network acts and two random values; 🚫 none of them are here.
 * This module decides what the redirect to Google must SAY, and its sibling
 * decides whether what came back may be BELIEVED. The `fetch`, the clock and
 * the randomness live at `apps/studio`'s one effect module — so every rule
 * below can be tested at an instant the test chose, with values it wrote down.
 *
 * 🚫 **IT KNOWS NO SECRET.** The client SECRET is used exactly once, at the
 * token exchange, which is an effect. Nothing in this package accepts one, and
 * a refusal here can therefore never leak one.
 */

/** Google's authorization endpoint. 🚫 Not configurable — a "which server do we trust" setting is a phishing switch. */
export const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

/** Google's token endpoint, named here so the effect edge has no URL of its own to get wrong. */
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/** 🚫 Never carries a token, a code, a secret or an email. */
export class GoogleSignInRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleSignInRefusedError';
  }
}

export interface GoogleAuthorizationRequest {
  readonly clientId: string;
  /**
   * 🛑 **AN ABSOLUTE `https://` URI, AND AGE'S OWN.** It is registered with the
   * Google client out of band; a mismatch is refused by Google, 🚫 not by us.
   */
  readonly redirectUri: string;
  /** ⚠️ Minted by the effect edge, echoed back by Google, compared on return. */
  readonly state: string;
  /** ⚠️ Minted by the effect edge, embedded in the ID token by Google. */
  readonly nonce: string;
}

/** Opaque handshake values are 32 bytes of hex, exactly as session tokens are. */
const HANDSHAKE_VALUE = /^[0-9a-f]{64}$/;

/**
 * The URL a browser is sent to in order to begin signing in.
 *
 * 🛑 **`scope` IS `openid email` AND 🚫 NOTHING MORE.** AGE needs to know WHICH
 * HUMAN is at the keyboard and nothing else about them — 🚫 not their calendar,
 * 🚫 not their contacts, 🚫 not their profile picture. Every additional scope is
 * data AGE would then hold, and the smallest request is the only one that
 * cannot leak what it never asked for.
 *
 * ⚠️ **`prompt=select_account`** so an operator with several Google accounts is
 * asked which one, rather than being silently signed in as whichever the
 * browser happened to hold. ⚠️ **`access_type=online`** so 🚫 no refresh token
 * is ever issued: AGE has no use for acting as the human later, and a refresh
 * token is exactly the credential that would let it.
 *
 * @throws {GoogleSignInRefusedError} naming the POSITION, 🚫 never the value.
 */
export function googleAuthorizationUrl(request: GoogleAuthorizationRequest): string {
  requirePresent('clientId', request.clientId);
  requireHttpsUri('redirectUri', request.redirectUri);
  requireHandshakeValue('state', request.state);
  requireHandshakeValue('nonce', request.nonce);

  const parameters = new URLSearchParams({
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state: request.state,
    nonce: request.nonce,
    prompt: 'select_account',
    access_type: 'online',
  });

  return `${GOOGLE_AUTHORIZATION_ENDPOINT}?${parameters.toString()}`;
}

function requirePresent(position: string, value: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new GoogleSignInRefusedError(
      `Refused: \`${position}\` is required to begin a Google sign-in and was empty. The refusal ` +
        'names the position and never the value, because the values in this handshake are ' +
        'credentials in every case that matters.',
    );
  }
}

/**
 * 🛑 **`https` ONLY, AND 🚫 NOT BECAUSE OF TRANSPORT.** The redirect URI is
 * where Google delivers an authorization code. Over `http` that code crosses
 * the network in the clear, and a code is a session in one exchange.
 */
function requireHttpsUri(position: string, value: string): void {
  requirePresent(position, value);

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new GoogleSignInRefusedError(
      `Refused: \`${position}\` must be an absolute URI and was not parseable as one.`,
    );
  }

  if (parsed.protocol !== 'https:') {
    throw new GoogleSignInRefusedError(
      `Refused: \`${position}\` must be an https URI. An authorization code delivered over http ` +
        'is a session anyone on the path can complete, and there is no deployment of AGE where ' +
        'that is acceptable — including a local one, which is why there is no exception.',
    );
  }
}

/**
 * 🛑 **THE SHAPE IS ASSERTED HERE SO A GUESSABLE HANDSHAKE CANNOT BE PASSED IN.**
 * `state` is the whole CSRF defence of the callback and `nonce` is the whole
 * replay defence of the ID token. A caller that could pass `"1"` would still
 * have a working sign-in — and no test would notice.
 */
function requireHandshakeValue(position: string, value: string): void {
  requirePresent(position, value);

  if (!HANDSHAKE_VALUE.test(value)) {
    throw new GoogleSignInRefusedError(
      `Refused: \`${position}\` must be 32 bytes of hex, minted where randomness lives. A short ` +
        'or predictable value is not a weaker defence, it is none: state stops a forged callback ' +
        'and nonce stops a replayed identity token.',
    );
  }
}
