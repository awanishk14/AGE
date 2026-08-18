import { describe, expect, it } from 'vitest';

import { issuedSessionRecord } from '../session-issuance';
import { hashSessionToken, SessionStoreRefusedError } from '../session-record';
import {
  MAXIMUM_SESSION_LIFETIME_SECONDS,
  MINIMUM_SESSION_LIFETIME_SECONDS,
} from '../session-lifetime';

/**
 * ⚠️ WHAT THESE PROVE: that an issued row carries the DIGEST and never the
 * token, that the ceiling cannot be walked past by issuing, that a session
 * begins un-revoked as an asserted fact rather than a default, and that a blank
 * identifier is refused instead of stored.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1). The token
 * below is 64 characters of the same two hex digits — 🛑 it is a SHAPE, not a
 * credential, and no real token ever appears in this repository.
 */

const TOKEN = 'ab'.repeat(32);
const ISSUED_AT = new Date('2026-08-18T09:00:00.000Z');

const request = (overrides: Record<string, unknown> = {}) => ({
  sessionId: 'session-fictional-1',
  organizationId: 'org-fictional-1',
  accountId: 'account-fictional-1',
  token: TOKEN,
  issuedAt: ISSUED_AT,
  lifetimeSeconds: 3600,
  ...overrides,
});

describe('issuedSessionRecord', () => {
  it('🛑 stores the digest and 🚫 never the token', () => {
    const record = issuedSessionRecord(request());

    expect(record.tokenHash).toBe(hashSessionToken(TOKEN));
    // 🛑 Asserted over the WHOLE row, not just the field it would obviously be
    // in: a token that leaked into `sessionId` would pass a field-by-field check.
    expect(JSON.stringify(record)).not.toContain(TOKEN);
  });

  it('computes the expiry from the lifetime, and 🚫 does not accept one', () => {
    const record = issuedSessionRecord(request({ lifetimeSeconds: 3600 }));

    expect(record.issuedAt).toBe('2026-08-18T09:00:00.000Z');
    expect(record.expiresAt).toBe('2026-08-18T10:00:00.000Z');
    // 🚫 There is no `expiresAt` on the request at all, so the ceiling below is
    // not advice a caller may decline.
    expect(Object.keys(request())).not.toContain('expiresAt');
  });

  it('🛑 refuses a lifetime past the ceiling — there is no "stay signed in forever"', () => {
    expect(() =>
      issuedSessionRecord(request({ lifetimeSeconds: MAXIMUM_SESSION_LIFETIME_SECONDS + 1 })),
    ).toThrow(SessionStoreRefusedError);
    expect(() =>
      issuedSessionRecord(request({ lifetimeSeconds: MINIMUM_SESSION_LIFETIME_SECONDS - 1 })),
    ).toThrow(SessionStoreRefusedError);
    // ⚠️ And the boundary itself is issuable, so the guard is a ceiling rather
    // than an off-by-one nobody would notice.
    expect(
      issuedSessionRecord(request({ lifetimeSeconds: MAXIMUM_SESSION_LIFETIME_SECONDS })).expiresAt,
    ).toBe('2026-08-18T21:00:00.000Z');
  });

  it('🚫 refuses a token that was not minted as 32 bytes of hex', () => {
    expect(() => issuedSessionRecord(request({ token: 'not-a-token' }))).toThrow(
      SessionStoreRefusedError,
    );
    expect(() => issuedSessionRecord(request({ token: TOKEN.toUpperCase() }))).toThrow(
      SessionStoreRefusedError,
    );
  });

  it('⚠️ begins un-revoked as an ASSERTED fact, not an absent field', () => {
    const record = issuedSessionRecord(request());

    expect(record.revokedAt).toBeNull();
    expect(Object.keys(record)).toContain('revokedAt');
  });

  it('🚫 refuses a blank identifier, naming the position and never the value', () => {
    for (const field of ['sessionId', 'organizationId', 'accountId']) {
      expect(() => issuedSessionRecord(request({ [field]: '   ' }))).toThrow(
        SessionStoreRefusedError,
      );
      try {
        issuedSessionRecord(request({ [field]: '   ' }));
      } catch (error) {
        expect((error as Error).message).toContain(field);
        expect((error as Error).message).not.toContain('org-fictional-1');
      }
    }
  });

  it('🚫 carries no scope, no bundle and no permission list (ADR-0062 D3)', () => {
    // 🛑 Scope is read from `account_memberships` on every request (ADR-0079 §2).
    // A field here would undo that in one line, and nobody would see it again.
    const record = issuedSessionRecord(request());

    expect(Object.keys(record).sort()).toEqual([
      'accountId',
      'expiresAt',
      'issuedAt',
      'organizationId',
      'revokedAt',
      'sessionId',
      'tokenHash',
    ]);
  });

  it('is a value, not a handle — the returned row is frozen', () => {
    const record = issuedSessionRecord(request());

    expect(Object.isFrozen(record)).toBe(true);
  });
});
