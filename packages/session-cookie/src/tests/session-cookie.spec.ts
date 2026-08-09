import { MAXIMUM_SESSION_LIFETIME_SECONDS } from '@age/session-store';
import { describe, expect, it } from 'vitest';

import {
  expireSessionCookie,
  readSessionCookie,
  SESSION_COOKIE_NAME,
  SessionCookieRefusedError,
  serializeSessionCookie,
} from '../session-cookie';

const TOKEN = 'a1b2c3d4'.repeat(8);

describe('the cookie a browser is asked to keep', () => {
  const cookie = serializeSessionCookie(TOKEN, 3600);

  it.each(['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/'])('carries %s', (attribute) => {
    expect(cookie).toContain(attribute);
  });

  it('carries the __Host- prefix, which the browser itself enforces', () => {
    // ⚠️ If a later change drops Secure or adds Domain, the browser rejects the
    // cookie outright — the mistake fails loudly instead of quietly.
    expect(SESSION_COOKIE_NAME.startsWith('__Host-')).toBe(true);
    expect(cookie.startsWith(`${SESSION_COOKIE_NAME}=${TOKEN}`)).toBe(true);
  });

  it('has no Domain, so it belongs to exactly one origin', () => {
    // 🚫 A Domain attribute shares the cookie with every subdomain, including
    // one somebody else operates one day.
    expect(cookie).not.toContain('Domain');
  });

  it('expires', () => {
    expect(cookie).toContain('Max-Age=3600');
  });

  it('carries the reference and nothing else', () => {
    // 🚫 No organization, no account, no role, no expiry the client could edit.
    const value = cookie.split(';')[0]?.split('=')[1];
    expect(value).toBe(TOKEN);
    expect(cookie.toLowerCase()).not.toContain('org');
    expect(cookie.toLowerCase()).not.toContain('account');
  });
});

describe('what a cookie may not carry', () => {
  it.each([
    ['a session-like claim', 'org-1|account-1'],
    ['a JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.x'],
    ['upper-case hex', 'A'.repeat(64)],
    ['a short value', 'abc'],
    ['an injected attribute', `${TOKEN}; Domain=.example.com`],
    ['blank', ''],
  ])('refuses %s', (_case, value) => {
    expect(() => serializeSessionCookie(value, 3600)).toThrow(SessionCookieRefusedError);
  });

  it('does not repeat the rejected value in the refusal', () => {
    try {
      serializeSessionCookie('super-secret-not-a-token', 3600);
      expect.unreachable('a non-token must be refused');
    } catch (error) {
      expect((error as Error).message).not.toContain('super-secret');
    }
  });
});

describe('a cookie may not outlive the session behind it', () => {
  it('permits exactly the ceiling', () => {
    expect(serializeSessionCookie(TOKEN, MAXIMUM_SESSION_LIFETIME_SECONDS)).toContain(
      `Max-Age=${MAXIMUM_SESSION_LIFETIME_SECONDS}`,
    );
  });

  it.each([
    ['one second past the ceiling', MAXIMUM_SESSION_LIFETIME_SECONDS + 1],
    ['a year', 365 * 24 * 60 * 60],
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['not a number', Number.NaN],
  ])('refuses %s', (_case, seconds) => {
    expect(() => serializeSessionCookie(TOKEN, seconds)).toThrow(SessionCookieRefusedError);
  });

  it('takes its ceiling from the session store, not a second copy of the number', () => {
    // ⚠️ Two ceilings is one ceiling somebody forgets to lower.
    expect(() => serializeSessionCookie(TOKEN, MAXIMUM_SESSION_LIFETIME_SECONDS)).not.toThrow();
    expect(() => serializeSessionCookie(TOKEN, MAXIMUM_SESSION_LIFETIME_SECONDS + 1)).toThrow();
  });
});

describe('expiring the cookie is not revocation', () => {
  const cleared = expireSessionCookie();

  it('asks the browser to drop it immediately', () => {
    expect(cleared).toContain('Max-Age=0');
    expect(cleared.startsWith(`${SESSION_COOKIE_NAME}=;`)).toBe(true);
  });

  it('keeps every attribute, so the browser accepts the replacement', () => {
    // ⚠️ A clearing cookie the browser rejects leaves the original in place —
    // the "logout" that does nothing at all.
    for (const attribute of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Strict']) {
      expect(cleared).toContain(attribute);
    }
  });

  it('carries no token to leak', () => {
    expect(cleared).not.toContain(TOKEN);
  });
});

describe('reading what a request offers', () => {
  it('finds the token among other cookies', () => {
    expect(readSessionCookie(`theme=dark; ${SESSION_COOKIE_NAME}=${TOKEN}; locale=en`)).toBe(TOKEN);
  });

  it('tolerates whitespace', () => {
    expect(readSessionCookie(`  ${SESSION_COOKIE_NAME} = ${TOKEN}  `)).toBe(TOKEN);
  });

  it.each([
    ['no header', undefined],
    ['an empty header', ''],
    ['another cookie only', 'theme=dark'],
    ['a similarly named cookie', `age_session=${TOKEN}`],
    ['a malformed value', `${SESSION_COOKIE_NAME}=not-a-token`],
    ['a value-less pair', SESSION_COOKIE_NAME],
  ])('offers nothing for %s', (_case, header) => {
    expect(readSessionCookie(header)).toBeUndefined();
  });

  it('is anonymity, not an error', () => {
    // ⚠️ An absent cookie is an ordinary request from someone not signed in.
    expect(() => readSessionCookie(undefined)).not.toThrow();
  });

  it('answers only what was offered, never whether it is usable', () => {
    // 🛑 A well-formed token from a revoked session still reads back here. That
    // question belongs to assessSession, and 🚫 this must never anticipate it.
    expect(readSessionCookie(`${SESSION_COOKIE_NAME}=${'0'.repeat(64)}`)).toBe('0'.repeat(64));
  });
});
