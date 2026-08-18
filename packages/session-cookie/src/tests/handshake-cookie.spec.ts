import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  expireHandshakeCookies,
  HANDSHAKE_COOKIE_MAX_AGE_SECONDS,
  HANDSHAKE_NONCE_COOKIE_NAME,
  HANDSHAKE_STATE_COOKIE_NAME,
  readHandshakeCookies,
  serializeHandshakeCookies,
} from '../handshake-cookie';
import { SESSION_COOKIE_NAME, SessionCookieRefusedError } from '../session-cookie';

const STATE = 'a'.repeat(64);
const NONCE = 'b'.repeat(64);
const HANDSHAKE = Object.freeze({ state: STATE, nonce: NONCE });

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === 'dist') return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('🛑 `SameSite=Lax` exists in exactly one file, and it is not the session cookie', () => {
  it('is stated literally by the handshake cookie', () => {
    expect(stripComments(readFileSync(join(SRC, 'handshake-cookie.ts'), 'utf8'))).toContain(
      "'SameSite=Lax'",
    );
  });

  it('🚫 appears in no other module of this package', () => {
    // 🛑 THE GUARD THAT MATTERS. The session cookie is `Strict` and the reason
    // it can be is that nothing links into the console. If a later change moved
    // it to `Lax` "for consistency with sign-in", the console would start
    // accepting cross-site top-level navigations that carry a live session.
    // ⚠️ The scan is the WHOLE package — a narrow scan is not a narrow rule.
    const offenders = sourceFiles(SRC).filter(
      (file) =>
        !file.endsWith('handshake-cookie.ts') &&
        stripComments(readFileSync(file, 'utf8')).includes('SameSite=Lax'),
    );

    expect(sourceFiles(SRC).length).toBeGreaterThanOrEqual(3);
    expect(offenders).toEqual([]);
  });

  it('🚫 and the handshake never touches the session cookie name', () => {
    expect(stripComments(readFileSync(join(SRC, 'handshake-cookie.ts'), 'utf8'))).not.toContain(
      SESSION_COOKIE_NAME,
    );
  });
});

describe('beginning a sign-in sets two short-lived, unreadable cookies', () => {
  it('names them with the browser-enforced __Host- prefix', () => {
    expect(HANDSHAKE_STATE_COOKIE_NAME).toBe('__Host-age_signin_state');
    expect(HANDSHAKE_NONCE_COOKIE_NAME).toBe('__Host-age_signin_nonce');
  });

  it('carries the values, HttpOnly, Secure and Path=/', () => {
    const [state, nonce] = serializeHandshakeCookies(HANDSHAKE);

    expect(state).toBe(
      `${HANDSHAKE_STATE_COOKIE_NAME}=${STATE}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    );
    expect(nonce).toBe(
      `${HANDSHAKE_NONCE_COOKIE_NAME}=${NONCE}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    );
  });

  it('⚠️ expires in ten minutes — 🚫 not with the session', () => {
    expect(HANDSHAKE_COOKIE_MAX_AGE_SECONDS).toBe(600);
    // 🛑 If this ever grew towards a session lifetime, a `nonce` would sit in a
    // browser long enough to be worth stealing for a replay.
    expect(HANDSHAKE_COOKIE_MAX_AGE_SECONDS).toBeLessThanOrEqual(900);
  });

  it('🚫 sets no Domain', () => {
    for (const cookie of serializeHandshakeCookies(HANDSHAKE)) {
      expect(cookie).not.toContain('Domain=');
    }
  });

  it.each([
    ['a short state', { state: 'abc' }],
    ['a short nonce', { nonce: '' }],
    ['a state that is not hex', { state: 'z'.repeat(64) }],
  ])('refuses %s, 🚫 without repeating it', (_label, override) => {
    expect(() => serializeHandshakeCookies({ ...HANDSHAKE, ...override })).toThrow(
      SessionCookieRefusedError,
    );
  });
});

describe('ending a sign-in clears both, whatever the outcome was', () => {
  it('clears them with the same attributes, or the browser keeps the originals', () => {
    expect(expireHandshakeCookies()).toEqual([
      `${HANDSHAKE_STATE_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      `${HANDSHAKE_NONCE_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    ]);
  });
});

describe('a handshake is read back whole or not at all', () => {
  it('reads both values out of a cookie header', () => {
    expect(
      readHandshakeCookies(
        `${HANDSHAKE_STATE_COOKIE_NAME}=${STATE}; ${HANDSHAKE_NONCE_COOKIE_NAME}=${NONCE}`,
      ),
    ).toEqual(HANDSHAKE);
  });

  it('reads them alongside an unrelated cookie', () => {
    expect(
      readHandshakeCookies(
        `other=1; ${HANDSHAKE_NONCE_COOKIE_NAME}=${NONCE}; ${HANDSHAKE_STATE_COOKIE_NAME}=${STATE}`,
      ),
    ).toEqual(HANDSHAKE);
  });

  it.each([
    ['no header at all', undefined],
    ['no handshake cookies', 'other=1'],
    ['a state but 🛑 no nonce', `${HANDSHAKE_STATE_COOKIE_NAME}=${'a'.repeat(64)}`],
    ['a nonce but 🛑 no state', `${HANDSHAKE_NONCE_COOKIE_NAME}=${'b'.repeat(64)}`],
    [
      'a state of the wrong shape',
      `${HANDSHAKE_STATE_COOKIE_NAME}=x; ${HANDSHAKE_NONCE_COOKIE_NAME}=${'b'.repeat(64)}`,
    ],
  ])('reads nothing from %s', (_label, header) => {
    // 🛑 A half-present handshake cannot replay-check an ID token, and the only
    // safe reading of one is that there is no handshake.
    expect(readHandshakeCookies(header)).toBeUndefined();
  });

  it('🚫 never throws on a request from a stranger', () => {
    expect(() => readHandshakeCookies('garbage')).not.toThrow();
  });
});
