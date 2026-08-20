import { describe, expect, it } from 'vitest';

import {
  ACTING_ORGANIZATION_COOKIE_ATTRIBUTES,
  ACTING_ORGANIZATION_COOKIE_NAME,
  ActingOrganizationRefusedError,
  expireActingOrganizationCookie,
  readActingOrganizationCookie,
  SESSION_COOKIE_NAME,
  serializeActingOrganizationCookie,
} from '../index';

/**
 * **THE CHOICE COOKIE** — ADR-0085.
 *
 * 🛑 **WHAT THESE TESTS ARE FOR:** this module introduces the second cookie AGE
 * has ever put on an operator's browser, and the dangerous reading of it is
 * "the platform operator's organization now travels in a cookie". It does not.
 * The tests below pin the properties that make that true — the value is
 * shape-checked before it can reach a header, and 🚫 nothing in this module
 * grants anything. The authorization half is the server's, on every request.
 */
describe('the acting-organization cookie (ADR-0085)', () => {
  it('is a __Host- cookie, and is not the session cookie', () => {
    expect(ACTING_ORGANIZATION_COOKIE_NAME.startsWith('__Host-')).toBe(true);

    // 🛑 Two cookies, two names, 🚫 never one reused for both. A shared name
    // would make forgetting a choice a sign-out, silently.
    expect(ACTING_ORGANIZATION_COOKIE_NAME).not.toBe(SESSION_COOKIE_NAME);
  });

  it('is Lax, deliberately', () => {
    // ⚠️ The session cookie is `Strict` because it is a credential (ADR-0084).
    // This one is a choice, and a `Strict` choice would be withheld on the hop
    // back from sign-in — the operator would land on the picker every time.
    expect([...ACTING_ORGANIZATION_COOKIE_ATTRIBUTES]).toEqual([
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
    ]);
  });

  it('serializes a choice with the attributes and a lifetime', () => {
    const cookie = serializeActingOrganizationCookie('org-fictional-nowhere', 3600);

    expect(cookie).toContain(`${ACTING_ORGANIZATION_COOKIE_NAME}=org-fictional-nowhere`);
    for (const attribute of ACTING_ORGANIZATION_COOKIE_ATTRIBUTES) {
      expect(cookie).toContain(attribute);
    }
    expect(cookie).toContain('Max-Age=3600');
  });

  /**
   * 🛑 **HEADER INJECTION IS THE FAILURE THAT WOULD MATTER HERE.** A newline in
   * a `Set-Cookie` value is a second header, and this value originates in a
   * form field on a page a signed-in operator can reach.
   */
  it.each([
    ['a newline', 'org-a\nSet-Cookie: __Host-age_session=x'],
    ['a carriage return', 'org-a\r\nLocation: https://elsewhere.example'],
    ['a semicolon', 'org-a; Domain=example.com'],
    ['an empty value', ''],
    ['an uppercase value', 'ORG-A'],
    ['a leading hyphen', '-org-a'],
  ])('refuses %s without repeating it', (_label, offered) => {
    expect(() => serializeActingOrganizationCookie(offered, 3600)).toThrow(
      ActingOrganizationRefusedError,
    );

    try {
      serializeActingOrganizationCookie(offered, 3600);
      expect.unreachable('the value above was serialized, and it must not be');
    } catch (error) {
      if (!(error instanceof ActingOrganizationRefusedError)) throw error;

      // 🚫 The refusal names the SHAPE, never the value (ADR-0054 D3).
      // ⚠️ The empty string is a substring of every message, so it is checked
      // by the `toThrow` above and 🚫 not by a containment that cannot fail.
      if (offered !== '') expect(error.message).not.toContain(offered);
    }
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses the lifetime %s', (seconds) => {
    expect(() => serializeActingOrganizationCookie('org-a', seconds)).toThrow(
      ActingOrganizationRefusedError,
    );
  });

  it('reads back a choice it wrote, alongside other cookies', () => {
    expect(
      readActingOrganizationCookie(
        `${SESSION_COOKIE_NAME}=${'a'.repeat(64)}; ${ACTING_ORGANIZATION_COOKIE_NAME}=org-b`,
      ),
    ).toBe('org-b');
  });

  it.each([
    ['no header at all', undefined],
    ['a header without it', 'other=1'],
    ['a malformed value', `${ACTING_ORGANIZATION_COOKIE_NAME}=Org With Spaces`],
    ['an empty value', `${ACTING_ORGANIZATION_COOKIE_NAME}=`],
  ])('reads %s as no choice rather than as an error', (_label, header) => {
    expect(readActingOrganizationCookie(header)).toBeUndefined();
  });

  it('expires the choice without expiring the session', () => {
    const cookie = expireActingOrganizationCookie();

    expect(cookie).toContain(`${ACTING_ORGANIZATION_COOKIE_NAME}=`);
    expect(cookie).toContain('Max-Age=0');
    // 🛑 Forgetting where you stood is 🚫 not signing out.
    expect(cookie).not.toContain(SESSION_COOKIE_NAME);
  });
});
