import { describe, expect, it } from 'vitest';

import { normalizeSessionRecord } from '../session-row';
import { SessionStoreRefusedError } from '../session-record';

const HASH = 'a'.repeat(64);

const ROW = Object.freeze({
  sessionId: 'session-1',
  organizationId: 'org-acme',
  accountId: 'account-1',
  tokenHash: HASH,
  issuedAt: '2026-08-11T09:00:00.000Z',
  expiresAt: '2026-08-11T17:00:00.000Z',
  revokedAt: null,
});

function refusalFor(row: unknown): SessionStoreRefusedError {
  try {
    normalizeSessionRecord(row);
  } catch (error) {
    return error as SessionStoreRefusedError;
  }

  throw new Error('Expected a refusal, and none was raised.');
}

describe('a stored row is untrusted input', () => {
  it('accepts a well-formed row and carries every field through unchanged', () => {
    expect(normalizeSessionRecord({ ...ROW })).toEqual(ROW);
  });

  it('accepts a revoked row — revocation is a fact, 🚫 not a malformation', () => {
    const revoked = { ...ROW, revokedAt: '2026-08-11T10:00:00.000Z' };

    expect(normalizeSessionRecord(revoked).revokedAt).toBe('2026-08-11T10:00:00.000Z');
  });

  it.each([
    ['not an object', 'a string'],
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
  ])('refuses %s', (_name, row) => {
    expect(() => normalizeSessionRecord(row)).toThrow(SessionStoreRefusedError);
  });

  it.each(['sessionId', 'organizationId', 'accountId', 'tokenHash', 'issuedAt', 'expiresAt'])(
    'refuses a row whose %s is missing',
    (field) => {
      const row: Record<string, unknown> = { ...ROW };
      delete row[field];

      expect(() => normalizeSessionRecord(row)).toThrow(SessionStoreRefusedError);
    },
  );

  it.each(['sessionId', 'organizationId', 'accountId', 'issuedAt', 'expiresAt'])(
    'refuses a row whose %s is blank',
    (field) => {
      // ⚠️ Two absences compare equal. A blank organization on a row would match
      // a blank organization on a request and read as agreement.
      expect(() => normalizeSessionRecord({ ...ROW, [field]: '   ' })).toThrow(
        SessionStoreRefusedError,
      );
    },
  );

  it('🚫 refuses a row whose expiry is absent — there is no "never expires"', () => {
    expect(() => normalizeSessionRecord({ ...ROW, expiresAt: null })).toThrow(
      SessionStoreRefusedError,
    );
  });

  it('refuses a revokedAt that is neither a timestamp nor null', () => {
    // ⚠️ `undefined` is refused too: "the column was not read" must not become
    // "the session was never revoked".
    expect(() => normalizeSessionRecord({ ...ROW, revokedAt: undefined })).toThrow(
      SessionStoreRefusedError,
    );
    expect(() => normalizeSessionRecord({ ...ROW, revokedAt: 7 })).toThrow(
      SessionStoreRefusedError,
    );
  });

  it.each([
    ['too short', 'a'.repeat(63)],
    ['upper case', 'A'.repeat(64)],
    ['not hex', 'z'.repeat(64)],
    ['a raw token’s length but not a digest', ''],
  ])('refuses a tokenHash that is %s', (_name, tokenHash) => {
    expect(() => normalizeSessionRecord({ ...ROW, tokenHash })).toThrow(SessionStoreRefusedError);
  });
});

describe('a refusal names a position, 🚫 never the row’s contents', () => {
  it('names the field and nothing that was in it', () => {
    // ADR-0054 D3 — a refusal must not carry a tenant, an account or a digest
    // into a log.
    const message = refusalFor({ ...ROW, organizationId: '' }).message;

    expect(message).toContain('organizationId');
    expect(message).not.toContain('session-1');
    expect(message).not.toContain('account-1');
    expect(message).not.toContain('org-acme');
  });

  it('🚫 never repeats the digest it refused', () => {
    const message = refusalFor({ ...ROW, tokenHash: 'b'.repeat(63) }).message;

    expect(message).toContain('tokenHash');
    expect(message).not.toContain('b'.repeat(20));
  });
});

describe('🚫 the normalizer adds nothing the row did not have', () => {
  it('does not default, generate or infer a single field', () => {
    const row: Record<string, unknown> = { ...ROW, surprise: 'ignored' };
    const normalized = normalizeSessionRecord(row);

    expect(Object.keys(normalized).sort()).toEqual(
      [
        'accountId',
        'expiresAt',
        'issuedAt',
        'organizationId',
        'revokedAt',
        'sessionId',
        'tokenHash',
      ].sort(),
    );
  });

  it('🚫 answers nothing about usability — that is `assessSession`, with a clock', () => {
    const normalized = normalizeSessionRecord({ ...ROW }) as unknown as Record<string, unknown>;

    expect(normalized['usable']).toBeUndefined();
    expect(normalized['session']).toBeUndefined();
  });
});
