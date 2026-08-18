/**
 * **WHETHER AN IDENTITY TOKEN FROM GOOGLE MAY BE BELIEVED** — ADR-0079 §6.3.
 *
 * 🛑 **WHY THERE IS NO SIGNATURE CHECK HERE, WRITTEN OUT SO NOBODY "FIXES" IT.**
 * This function is only ever handed an `id_token` that AGE received as the BODY
 * OF ITS OWN HTTPS POST to `https://oauth2.googleapis.com/token`, authenticated
 * with the client secret. That is a direct, server-to-server, TLS-authenticated
 * channel from Google, and a token obtained that way is trusted on the strength
 * of the transport. ⚠️ **THE MOMENT AN ID TOKEN ARRIVES BY ANY OTHER ROUTE — a
 * browser, a peer product, a query parameter — THIS FUNCTION IS THE WRONG TOOL
 * AND SIGNATURE VERIFICATION BECOMES MANDATORY.** 🚫 Do not widen the caller
 * without changing this, and 🚫 do not describe this as "verifying a JWT". It
 * reads claims off a payload whose ORIGIN is already proven, and checks that
 * they say what this particular sign-in asked for.
 *
 * 🛑 **THE CLAIMS ARE CHECKED EVEN SO, AND EACH ONE STOPS A DIFFERENT ATTACK.**
 * `aud` stops a token minted for a DIFFERENT application being replayed at AGE
 * — the most common OAuth defect there is. `iss` stops a token from anywhere
 * but Google. `exp` stops an old one. `nonce` stops the replay of a token from
 * an earlier sign-in by the same person. `email_verified` stops an unproven
 * address from matching a real account row.
 *
 * 🚫 **NOTHING HERE AUTHORIZES ANYTHING** (ADR-0046 D5). A verified identity is
 * a NAME. Whether that name may sign in to this deployment is decided
 * afterwards, from rows a human provisioned.
 *
 * Pure: no clock (`now` is given), no I/O, no crypto, no network.
 */

export interface GoogleIdentityExpectation {
  /** The client the token must have been minted FOR. */
  readonly clientId: string;
  /** The nonce this sign-in sent to Google, minted at the effect edge. */
  readonly nonce: string;
  /** The instant to judge `exp` against. 🚫 Not a clock read. */
  readonly now: Date;
}

export type GoogleIdentityVerification =
  | { readonly outcome: 'verified'; readonly email: string; readonly subject: string }
  | { readonly outcome: 'unverified'; readonly reason: GoogleIdentityRefusalReason };

/**
 * ⚠️ **THE REASONS STAY DISTINCT INSIDE AGE AND ARE COLLAPSED ON THE WAY OUT** —
 * the discipline the session store already uses. An operator staring at a
 * refused sign-in must not be told which check failed, because that tells an
 * attacker which one to work on; a host operator reading a log needs to know
 * whether Google is misconfigured or a token was replayed.
 */
export type GoogleIdentityRefusalReason =
  | 'malformed'
  | 'wrong-audience'
  | 'wrong-issuer'
  | 'expired'
  | 'nonce-mismatch'
  | 'email-unverified'
  | 'no-email';

/** Both spellings Google uses for `iss`. 🚫 Compared exactly, never as a prefix. */
const GOOGLE_ISSUERS: readonly string[] = Object.freeze([
  'accounts.google.com',
  'https://accounts.google.com',
]);

/**
 * Reads an identity out of a Google ID token, or refuses with a reason.
 *
 * ⚠️ **IT RETURNS A RESULT AND 🚫 DOES NOT THROW.** A token that does not check
 * out is an ordinary outcome on a login route open to the public internet, and
 * a thrown error there is a 500 where a refusal belongs.
 */
export function verifiedGoogleIdentity(
  idToken: string,
  expectation: GoogleIdentityExpectation,
): GoogleIdentityVerification {
  const claims = decodeClaims(idToken);

  if (claims === undefined) return unverified('malformed');

  // ⚠️ `aud` FIRST. A token minted for another application is the case where
  // every other check passes and the answer is still wrong.
  if (claims['aud'] !== expectation.clientId) return unverified('wrong-audience');

  const issuer = claims['iss'];

  if (typeof issuer !== 'string' || !GOOGLE_ISSUERS.includes(issuer)) {
    return unverified('wrong-issuer');
  }

  const expiry = claims['exp'];

  // ⚠️ `exp` is SECONDS since the epoch and `Date` is milliseconds. Comparing
  // them directly makes every token look valid for about fifty thousand years.
  if (typeof expiry !== 'number' || !Number.isFinite(expiry)) return unverified('malformed');
  if (expiry * 1000 <= expectation.now.getTime()) return unverified('expired');

  const nonce = claims['nonce'];

  // 🛑 Compared against the nonce THIS sign-in minted. A token carrying no
  // nonce is refused rather than accepted: an absent value must never be able
  // to match an expected one.
  if (typeof nonce !== 'string' || nonce !== expectation.nonce) {
    return unverified('nonce-mismatch');
  }

  const email = claims['email'];

  if (typeof email !== 'string' || email.trim() === '') return unverified('no-email');

  // 🛑 **AN UNVERIFIED ADDRESS IS NOT AN IDENTITY.** Without this, anyone who
  // can set an unverified address on any Google account could sign in as
  // whichever operator that address matches in `accounts`.
  if (claims['email_verified'] !== true) return unverified('email-unverified');

  const subject = claims['sub'];

  if (typeof subject !== 'string' || subject.trim() === '') return unverified('malformed');

  // ⚠️ Lower-cased ONCE, here, so the directory lookup never has to decide.
  return Object.freeze({
    outcome: 'verified' as const,
    email: email.trim().toLowerCase(),
    subject,
  });
}

function unverified(reason: GoogleIdentityRefusalReason): GoogleIdentityVerification {
  return Object.freeze({ outcome: 'unverified' as const, reason });
}

/**
 * The payload of a JWT, decoded and 🚫 NOT verified.
 *
 * ⚠️ **DELIBERATELY NOT EXPORTED.** A decoder available to the rest of the
 * product is an invitation to read a claim somewhere that skipped the checks
 * above, and *"the copy that gets relaxed still passes its own tests"* applies
 * to claims exactly as it applies to database grants.
 */
function decodeClaims(idToken: string): Readonly<Record<string, unknown>> | undefined {
  if (typeof idToken !== 'string') return undefined;

  const segments = idToken.split('.');

  if (segments.length !== 3) return undefined;

  const payload = segments[1];

  if (payload === undefined || payload === '') return undefined;

  try {
    // ⚠️ base64URL, not base64: JWT spells `+` as `-` and `/` as `_`.
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    const decoded: unknown = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));

    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
      return undefined;
    }

    return decoded as Record<string, unknown>;
  } catch {
    // 🚫 The token is not echoed into the refusal, here or anywhere.
    return undefined;
  }
}
