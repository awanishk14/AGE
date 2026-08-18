/**
 * `@age/google-sign-in` — **the pure half of ADR-0079 slice 3.**
 *
 * 🛑 **THIS PACKAGE PERFORMS NO EFFECT.** It builds a URL and it reads claims
 * off a payload. 🚫 It does not fetch, 🚫 it does not read a clock, 🚫 it does
 * not mint a `state`, a `nonce` or a token, and 🚫 it holds no secret. Every one
 * of those is an effect, and effects live at `apps/studio`'s ONE effect module.
 *
 * 🚫 **AND IT AUTHORIZES NOTHING.** Google says who someone is. Whether that
 * person may sign in to this deployment is answered from `accounts` and
 * `account_memberships`, which a human provisioned — **AGE mints nothing.**
 */

export {
  GOOGLE_AUTHORIZATION_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GoogleSignInRefusedError,
  googleAuthorizationUrl,
  type GoogleAuthorizationRequest,
} from './authorization-request';

export {
  verifiedGoogleIdentity,
  type GoogleIdentityExpectation,
  type GoogleIdentityRefusalReason,
  type GoogleIdentityVerification,
} from './identity-claims';
