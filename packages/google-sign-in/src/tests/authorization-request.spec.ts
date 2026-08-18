import { describe, expect, it } from 'vitest';

import {
  GOOGLE_AUTHORIZATION_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GoogleSignInRefusedError,
  googleAuthorizationUrl,
} from '../authorization-request';

/**
 * ADR-0079 slice 3 — **what the redirect to Google is allowed to say.**
 *
 * 🚫 These are not "does it build a URL" tests. Each case below is a refusal
 * that has to survive somebody later finding it inconvenient.
 */

const STATE = 'a'.repeat(64);
const NONCE = 'b'.repeat(64);

const REQUEST = Object.freeze({
  clientId: '000000000000-fictional.apps.googleusercontent.invalid',
  redirectUri: 'https://age.example.invalid/sign-in/callback',
  state: STATE,
  nonce: NONCE,
});

function parametersOf(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe('the authorization URL asks Google for the least it can', () => {
  it('goes to Google and 🚫 nowhere configurable', () => {
    expect(googleAuthorizationUrl(REQUEST).startsWith(`${GOOGLE_AUTHORIZATION_ENDPOINT}?`)).toBe(
      true,
    );
    expect(GOOGLE_AUTHORIZATION_ENDPOINT.startsWith('https://accounts.google.com/')).toBe(true);
    expect(GOOGLE_TOKEN_ENDPOINT.startsWith('https://oauth2.googleapis.com/')).toBe(true);
  });

  it('🛑 requests `openid email` and 🚫 not one scope more', () => {
    // ⚠️ Asserted as an EXACT string, 🚫 not with `toContain`. A widened scope
    // that still contained `openid email` would pass a containment check, and
    // widening the scope is precisely the change this test exists to catch.
    expect(parametersOf(googleAuthorizationUrl(REQUEST)).get('scope')).toBe('openid email');
  });

  it('🚫 never asks for a refresh token, and always asks which account', () => {
    const parameters = parametersOf(googleAuthorizationUrl(REQUEST));

    expect(parameters.get('access_type')).toBe('online');
    expect(parameters.get('prompt')).toBe('select_account');
    expect(parameters.get('response_type')).toBe('code');
  });

  it('carries the handshake values it was given, unaltered', () => {
    const parameters = parametersOf(googleAuthorizationUrl(REQUEST));

    expect(parameters.get('state')).toBe(STATE);
    expect(parameters.get('nonce')).toBe(NONCE);
    expect(parameters.get('client_id')).toBe(REQUEST.clientId);
    expect(parameters.get('redirect_uri')).toBe(REQUEST.redirectUri);
  });

  it('🚫 sends nothing else — the parameter set is closed', () => {
    expect([...parametersOf(googleAuthorizationUrl(REQUEST)).keys()].sort()).toEqual([
      'access_type',
      'client_id',
      'nonce',
      'prompt',
      'redirect_uri',
      'response_type',
      'scope',
      'state',
    ]);
  });
});

describe('a handshake that could not defend anything is refused', () => {
  it.each([
    ['a short state', { state: 'abc' }],
    ['a short nonce', { nonce: 'abc' }],
    ['a state that is not hex', { state: 'g'.repeat(64) }],
    ['a nonce that is not hex', { nonce: 'G'.repeat(64) }],
    ['an empty state', { state: '' }],
  ])('refuses %s', (_label, override) => {
    expect(() => googleAuthorizationUrl({ ...REQUEST, ...override })).toThrow(
      GoogleSignInRefusedError,
    );
  });

  it('🛑 refuses an http redirect URI — a code in the clear is a session', () => {
    expect(() =>
      googleAuthorizationUrl({ ...REQUEST, redirectUri: 'http://age.example.invalid/callback' }),
    ).toThrow(/https/);
  });

  it('refuses a relative redirect URI', () => {
    expect(() => googleAuthorizationUrl({ ...REQUEST, redirectUri: '/sign-in/callback' })).toThrow(
      GoogleSignInRefusedError,
    );
  });

  it('refuses an absent client id', () => {
    expect(() => googleAuthorizationUrl({ ...REQUEST, clientId: '   ' })).toThrow(
      /`clientId` is required/,
    );
  });

  it('🚫 names the position and never the value', () => {
    // 🛑 A refusal that echoed the state would put the CSRF defence of the next
    // sign-in into a log line. It names `state`; it does not repeat it.
    const secret = 'c'.repeat(63);

    try {
      googleAuthorizationUrl({ ...REQUEST, state: secret });
      expect.unreachable('the short state should have been refused');
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleSignInRefusedError);
      expect((error as Error).message).toContain('`state`');
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
