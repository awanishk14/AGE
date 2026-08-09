import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  assessSession,
  assertSessionTokenShape,
  hashSessionToken,
  sessionTokenHashesMatch,
  SessionStoreRefusedError,
  type SessionRecord,
} from '../session-record';

const TOKEN = 'a'.repeat(64);
const AT = (iso: string) => new Date(iso);

const record = (overrides: Partial<SessionRecord> = {}): SessionRecord => ({
  sessionId: 'session-1',
  organizationId: 'org-1',
  accountId: 'account-1',
  tokenHash: hashSessionToken(TOKEN),
  issuedAt: '2026-08-09T09:00:00.000Z',
  expiresAt: '2026-08-09T21:00:00.000Z',
  revokedAt: null,
  ...overrides,
});

describe('the token is recognised, never invented', () => {
  it('accepts 32 bytes of lower-case hex', () => {
    expect(assertSessionTokenShape(TOKEN)).toBe(TOKEN);
  });

  it.each([
    ['blank', ''],
    ['too short', 'a'.repeat(63)],
    ['too long', 'a'.repeat(65)],
    ['upper case', 'A'.repeat(64)],
    ['not hex', 'z'.repeat(64)],
    ['a password', 'correct-horse-battery-staple'],
  ])('refuses a %s token', (_case, candidate) => {
    expect(() => assertSessionTokenShape(candidate)).toThrow(SessionStoreRefusedError);
  });

  it('never puts the token in the refusal', () => {
    const secret = 'deadbeef'.repeat(7);
    try {
      assertSessionTokenShape(secret);
      expect.unreachable('a short token should have been refused');
    } catch (error) {
      expect((error as Error).message).not.toContain('deadbeef');
    }
  });
});

describe('only the digest is ever stored', () => {
  it('is the SHA-256 of the token', () => {
    expect(hashSessionToken(TOKEN)).toBe(createHash('sha256').update(TOKEN, 'utf8').digest('hex'));
  });

  it('does not contain the token', () => {
    expect(hashSessionToken(TOKEN)).not.toContain(TOKEN);
  });

  it('refuses to hash something that was never minted here', () => {
    // 🚫 Hashing a guessable value would give it the appearance of a session.
    expect(() => hashSessionToken('hunter2')).toThrow(SessionStoreRefusedError);
  });

  it('matches equal digests and rejects unequal ones', () => {
    const hash = hashSessionToken(TOKEN);
    expect(sessionTokenHashesMatch(hash, hash)).toBe(true);
    expect(sessionTokenHashesMatch(hash, hashSessionToken('b'.repeat(64)))).toBe(false);
    expect(sessionTokenHashesMatch(hash, '')).toBe(false);
    expect(sessionTokenHashesMatch(hash, `${hash}0`)).toBe(false);
  });
});

describe('a row becomes a session only by being assessed', () => {
  it('is usable inside its window', () => {
    const assessment = assessSession(record(), AT('2026-08-09T12:00:00.000Z'));

    expect(assessment.usable).toBe(true);
    if (!assessment.usable) return;
    expect(assessment.session.organizationId).toBe('org-1');
    // 🚫 No role, no isAdmin, no permission list reaches the session.
    expect(Object.keys(assessment.session).sort()).toEqual([
      'accountId',
      'organizationId',
      'sessionId',
    ]);
  });

  it('is expired at its expiry instant, not after it', () => {
    // ⚠️ The boundary is the interesting case: `<=`, so the instant of expiry is
    // already too late.
    const assessment = assessSession(record(), AT('2026-08-09T21:00:00.000Z'));
    expect(assessment).toEqual({ usable: false, reason: 'expired' });
  });

  it('reports revoked rather than expired when it is both', () => {
    // 🛑 Order is load-bearing: "we shut this down" is the fact asked about.
    const assessment = assessSession(
      record({ revokedAt: '2026-08-09T10:00:00.000Z' }),
      AT('2026-08-10T09:00:00.000Z'),
    );

    expect(assessment).toEqual({ usable: false, reason: 'revoked' });
  });

  it('is still usable before a future revocation instant', () => {
    const assessment = assessSession(
      record({ revokedAt: '2026-08-09T20:00:00.000Z' }),
      AT('2026-08-09T12:00:00.000Z'),
    );

    expect(assessment.usable).toBe(true);
  });

  it.each([
    ['an unreadable expiry', { expiresAt: 'whenever' }],
    ['an unreadable revocation', { revokedAt: 'yesterday' }],
    ['a blank organization', { organizationId: '   ' }],
    ['a blank session id', { sessionId: '' }],
    ['a blank account', { accountId: '' }],
  ])('refuses %s as unreadable rather than usable', (_case, overrides) => {
    const assessment = assessSession(
      record(overrides as Partial<SessionRecord>),
      AT('2026-08-09T12:00:00.000Z'),
    );

    expect(assessment).toEqual({ usable: false, reason: 'unreadable' });
  });

  it('reads no clock of its own', () => {
    // ⚠️ The same row, two instants, two answers — which is only possible
    // because `now` is a parameter.
    const row = record();
    expect(assessSession(row, AT('2026-08-09T12:00:00.000Z')).usable).toBe(true);
    expect(assessSession(row, AT('2027-01-01T00:00:00.000Z')).usable).toBe(false);
  });
});
