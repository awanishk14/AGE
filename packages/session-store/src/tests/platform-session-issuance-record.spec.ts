import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assessSession,
  hashSessionToken,
  normalizeSessionRecord,
  platformIssuedSessionRecord,
  SessionStoreRefusedError,
} from '../index';

/**
 * ADR-0083 **D1** — the row that issues a session belonging to 🚫 no tenant.
 *
 * 🛑 **THE `null` IS WRITTEN OUT, AND THAT IS THE WHOLE ASSERTION.** A record
 * that OMITTED the key would be refused by `normalizeSessionRecord` on the way
 * back in — so the round trip below is not ceremony: it is the proof that what
 * this function produces is a row the store will accept as a principal, rather
 * than one it will refuse as an unread column.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const TOKEN = 'd'.repeat(64);
const ISSUED_AT = new Date('2026-08-19T10:00:00.000Z');
const EIGHT_HOURS = 8 * 60 * 60;

const request = (overrides: Record<string, unknown> = {}) => ({
  sessionId: 'session-fictional-9',
  accountId: 'operator-fictional-9',
  token: TOKEN,
  issuedAt: ISSUED_AT,
  lifetimeSeconds: EIGHT_HOURS,
  ...overrides,
});

describe('platformIssuedSessionRecord', () => {
  it('🛑 carries `organizationId: null` as a PRESENT key', () => {
    const record = platformIssuedSessionRecord(request());

    expect('organizationId' in record).toBe(true);
    expect(record.organizationId).toBeNull();
  });

  it('🛑 round-trips through the reader that refuses an unread column', () => {
    const record = platformIssuedSessionRecord(request());

    // 🛑 THE ROUND TRIP IS THE PROOF. A row whose key had been omitted would be
    // refused here — which is exactly what should happen to an unread column,
    // and exactly what must NOT happen to a session AGE just issued.
    const stored = normalizeSessionRecord({ ...record });

    expect(stored.organizationId).toBeNull();

    const assessment = assessSession(stored, new Date('2026-08-19T12:00:00.000Z'));
    expect(assessment.usable).toBe(true);
    if (!assessment.usable) return;
    expect(assessment.principal.scope).toBe('platform');
  });

  it('🚫 stores the digest, and the raw token appears nowhere in the row', () => {
    const record = platformIssuedSessionRecord(request());

    expect(record.tokenHash).toBe(hashSessionToken(TOKEN));
    expect(JSON.stringify(record)).not.toContain(TOKEN);
  });

  it('⚠️ computes the expiry from the lifetime — 🚫 it is never supplied', () => {
    const record = platformIssuedSessionRecord(request());

    expect(record.issuedAt).toBe('2026-08-19T10:00:00.000Z');
    expect(record.expiresAt).toBe('2026-08-19T18:00:00.000Z');
    expect(record.revokedAt).toBeNull();
  });

  it.each([
    ['a token that was not minted here', { token: 'nope' }],
    ['a lifetime past the ceiling', { lifetimeSeconds: 60 * 60 * 24 * 365 }],
    ['a blank sessionId', { sessionId: '   ' }],
    ['a blank accountId', { accountId: '' }],
  ])('🛑 refuses %s', (_label, overrides) => {
    expect(() => platformIssuedSessionRecord(request(overrides) as never)).toThrow(
      SessionStoreRefusedError,
    );
  });

  it('names the POSITION and 🚫 never the value', () => {
    try {
      platformIssuedSessionRecord(request({ accountId: '   ' }) as never);
      expect.unreachable('a blank accountId must be refused');
    } catch (error) {
      expect((error as Error).message).toContain('accountId');
      expect((error as Error).message).not.toContain('session-fictional-9');
    }
  });

  it('🛑 shares ONE blank-identifier refusal with the tenant path (D3)', () => {
    const source = readFileSync(join(__dirname, '..', 'session-issuance.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    // ⚠️ One definition, called from both. 🚫 Two definitions would satisfy
    // every behavioural test above and still be the drift D3 forbids.
    expect(source.match(/function acceptIdentifier/g)).toHaveLength(1);
    expect(source.match(/sessionExpiryFrom\(/g)).toHaveLength(2);
    expect(source.match(/hashSessionToken\(/g)).toHaveLength(2);
  });

  it('🚫 offers no organization on the platform request type', () => {
    const source = readFileSync(join(__dirname, '..', 'session-issuance.ts'), 'utf8');
    const start = source.indexOf('export interface PlatformSessionIssuanceRequest');
    const block = source.slice(start, source.indexOf('}', start));

    expect(start).toBeGreaterThan(-1);
    expect(block).not.toContain('organizationId');
  });
});
