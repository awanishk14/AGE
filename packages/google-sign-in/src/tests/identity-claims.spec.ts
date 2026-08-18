import { describe, expect, it } from 'vitest';

import { verifiedGoogleIdentity } from '../identity-claims';

/**
 * ADR-0079 slice 3 — **which identity tokens may be believed.**
 *
 * ⚠️ Every token below is ASSEMBLED HERE from claims the test wrote down. 🚫 No
 * real Google token appears in this repository, and 🚫 none ever should: a real
 * one carries a real person's address and subject, which is client data.
 */

const CLIENT_ID = '000000000000-fictional.apps.googleusercontent.invalid';
const NONCE = 'b'.repeat(64);
const NOW = new Date('2026-08-18T09:00:00.000Z');

/** Seconds since the epoch, one hour after `NOW`. */
const NOT_YET_EXPIRED = Math.floor(NOW.getTime() / 1000) + 3600;

function tokenOf(claims: Readonly<Record<string, unknown>>): string {
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');

  // ⚠️ The header and signature are structurally present and 🚫 never read.
  return `header.${payload}.signature`;
}

const GOOD_CLAIMS = Object.freeze({
  aud: CLIENT_ID,
  iss: 'https://accounts.google.com',
  exp: NOT_YET_EXPIRED,
  nonce: NONCE,
  email: 'Operator@Example.Invalid',
  email_verified: true,
  sub: '000000000000000000001',
});

const EXPECTATION = Object.freeze({ clientId: CLIENT_ID, nonce: NONCE, now: NOW });

describe('a well-formed token from Google names an operator', () => {
  it('reads the email and the subject', () => {
    expect(verifiedGoogleIdentity(tokenOf(GOOD_CLAIMS), EXPECTATION)).toEqual({
      outcome: 'verified',
      email: 'operator@example.invalid',
      subject: '000000000000000000001',
    });
  });

  it('⚠️ lower-cases the address ONCE, here', () => {
    // The directory lookup must never have to decide how to compare; a second
    // place that lowercases is a second place that can stop.
    const verification = verifiedGoogleIdentity(
      tokenOf({ ...GOOD_CLAIMS, email: 'MIXED@Example.Invalid' }),
      EXPECTATION,
    );

    expect(verification).toMatchObject({ outcome: 'verified', email: 'mixed@example.invalid' });
  });

  it('accepts both spellings Google uses for the issuer', () => {
    expect(
      verifiedGoogleIdentity(tokenOf({ ...GOOD_CLAIMS, iss: 'accounts.google.com' }), EXPECTATION),
    ).toMatchObject({ outcome: 'verified' });
  });
});

describe('🛑 every claim that could be wrong is refused, by its own reason', () => {
  it.each([
    ['a token minted for another application', { aud: 'someone-elses.invalid' }, 'wrong-audience'],
    [
      'a token from anywhere but Google',
      { iss: 'https://accounts.google.com.evil.invalid' },
      'wrong-issuer',
    ],
    ['a token with no issuer at all', { iss: undefined }, 'wrong-issuer'],
    ['an unverified address', { email_verified: false }, 'email-unverified'],
    ['a missing `email_verified`', { email_verified: undefined }, 'email-unverified'],
    ['no address', { email: '' }, 'no-email'],
    ['a replayed identity from an earlier sign-in', { nonce: 'c'.repeat(64) }, 'nonce-mismatch'],
    ['a token carrying no nonce', { nonce: undefined }, 'nonce-mismatch'],
    ['no subject', { sub: '' }, 'malformed'],
    ['an `exp` that is not a number', { exp: 'soon' }, 'malformed'],
  ])('refuses %s', (_label, override, reason) => {
    expect(verifiedGoogleIdentity(tokenOf({ ...GOOD_CLAIMS, ...override }), EXPECTATION)).toEqual({
      outcome: 'unverified',
      reason,
    });
  });

  it('🛑 refuses an expired token, and treats `exp` as SECONDS', () => {
    const oneSecondAgo = Math.floor(NOW.getTime() / 1000) - 1;

    expect(
      verifiedGoogleIdentity(tokenOf({ ...GOOD_CLAIMS, exp: oneSecondAgo }), EXPECTATION),
    ).toEqual({ outcome: 'unverified', reason: 'expired' });

    // ⚠️ If `exp` were read as milliseconds, this SECONDS value would look like
    // 1970 and be refused; if the comparison dropped the ×1000, an expiry one
    // second in the future would look like 1970 too. Both directions are
    // pinned by asserting the good token above verifies at the same `now`.
    expect(verifiedGoogleIdentity(tokenOf(GOOD_CLAIMS), EXPECTATION)).toMatchObject({
      outcome: 'verified',
    });
  });

  it('refuses a token that expires exactly now — 🚫 the boundary is not slack', () => {
    expect(
      verifiedGoogleIdentity(
        tokenOf({ ...GOOD_CLAIMS, exp: Math.floor(NOW.getTime() / 1000) }),
        EXPECTATION,
      ),
    ).toEqual({ outcome: 'unverified', reason: 'expired' });
  });

  it.each([
    ['a token that is not three segments', 'not.a.jwt.at.all'],
    ['an empty string', ''],
    ['a payload that is not JSON', 'header.bm90LWpzb24.signature'],
    ['a payload that is a JSON array', `header.${Buffer.from('[1,2]').toString('base64url')}.sig`],
  ])('refuses %s as malformed', (_label, token) => {
    expect(verifiedGoogleIdentity(token, EXPECTATION)).toEqual({
      outcome: 'unverified',
      reason: 'malformed',
    });
  });

  it('🚫 never throws — a bad token on a public route is a refusal, not a 500', () => {
    expect(() => verifiedGoogleIdentity('nonsense', EXPECTATION)).not.toThrow();
  });
});

describe('the verification is a NAME and 🚫 not an authorization', () => {
  it('returns no scope, no organization and no permission of any kind', () => {
    const verification = verifiedGoogleIdentity(tokenOf(GOOD_CLAIMS), EXPECTATION);

    // 🛑 ADR-0046 D5. If this ever grows a `scope` or an `organizationId`, the
    // product has started trusting Google to say who may see a tenant's data.
    expect(Object.keys(verification).sort()).toEqual(['email', 'outcome', 'subject']);
  });
});
