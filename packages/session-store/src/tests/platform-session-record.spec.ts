import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { assessSession, normalizeSessionRecord, SessionStoreRefusedError } from '../index';

/**
 * ADR-0083 **D1 option B**, in the store — a row that belongs to no tenant.
 *
 * 🛑 **THE ABSENCE THAT MATTERS IS `undefined`, 🚫 NOT `null`.** `null` is a
 * DECISION someone recorded: this session speaks for no organization.
 * `undefined` is a column that was not read, and letting it become `null` would
 * promote a tenant operator to the widest scope AGE has — silently, and it would
 * look exactly like a working sign-in. Every guard below exists for that step.
 *
 * ⚠️ **D3 IS ASSERTED PRODUCT-WIDE**, 🚫 not over these files. A second copy of
 * expiry or revocation in another package would be invisible to a scan that only
 * looked here, and the copy that drifts still passes its own tests.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const SRC = join(__dirname, '..');
const REPO_ROOT = join(SRC, '..', '..', '..');
const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist', '.nx', '.next']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    // ⚠️ Pruned DURING the recursion, never filtered afterwards — filtering
    // afterwards `stat`s files other vitest processes are deleting.
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
  });
}

const ROOTS = ['packages', 'apps'].map((dir) => join(REPO_ROOT, dir)).filter(existsSync);
const REPO_FILES = ROOTS.flatMap((root) => sourceFiles(root));

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const repoRelative = (file: string): string =>
  file
    .slice(REPO_ROOT.length + 1)
    .split('\\')
    .join('/');

const TOKEN_HASH = 'b'.repeat(64);

const platformRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sessionId: 'session-fictional-9',
  organizationId: null,
  accountId: 'operator-fictional-9',
  tokenHash: TOKEN_HASH,
  issuedAt: '2026-08-09T10:00:00.000Z',
  expiresAt: '2026-08-09T18:00:00.000Z',
  revokedAt: null,
  ...overrides,
});

const AT = (iso: string): Date => new Date(iso);

describe('🛑 a stored row may belong to NO organization (ADR-0083 D1)', () => {
  it('accepts exactly `null`', () => {
    expect(normalizeSessionRecord(platformRow()).organizationId).toBeNull();
  });

  it('🛑 refuses an ABSENT `organizationId` — an unread column is 🚫 not a platform session', () => {
    const withoutTheColumn = platformRow();
    delete withoutTheColumn['organizationId'];

    expect(() => normalizeSessionRecord(withoutTheColumn)).toThrow(SessionStoreRefusedError);
  });

  it('🛑 refuses `undefined` written explicitly, exactly as it refuses the missing key', () => {
    expect(() => normalizeSessionRecord(platformRow({ organizationId: undefined }))).toThrow(
      SessionStoreRefusedError,
    );
  });

  it.each([['   '], [''], [42], [{}], [[]]])('refuses %o as an organization', (value) => {
    expect(() => normalizeSessionRecord(platformRow({ organizationId: value }))).toThrow(
      SessionStoreRefusedError,
    );
  });

  it('names the FIELD and 🚫 never the value it refused', () => {
    try {
      normalizeSessionRecord(platformRow({ organizationId: ['org-fictional-secret'] }));
      expect.unreachable('an array is not an organization');
    } catch (error) {
      const message = (error as Error).message;

      expect(message).toContain('organizationId');
      // 🚫 ADR-0054 D3 — an organization in a log is a tenant in a log.
      expect(message).not.toContain('org-fictional-secret');
    }
  });

  it('🚫 leaves the tenant row untouched (D2)', () => {
    const tenant = normalizeSessionRecord(platformRow({ organizationId: 'org-fictional-1' }));

    expect(tenant.organizationId).toBe('org-fictional-1');
  });
});

describe('🛑 a platform row assesses into a principal with 🚫 no organization', () => {
  it('yields the platform arm, and the organization field does not exist', () => {
    const assessment = assessSession(
      normalizeSessionRecord(platformRow()),
      AT('2026-08-09T12:00:00.000Z'),
    );

    expect(assessment.usable).toBe(true);
    if (!assessment.usable) return;
    expect(assessment.principal.scope).toBe('platform');
    // 🛑 THE KEY LIST, 🚫 not a spot check. An `organizationId` that appeared
    // later would pass every assertion about the two fields that ARE here.
    expect(Object.keys(assessment.principal.session).sort()).toEqual(['accountId', 'sessionId']);
    expect(
      (assessment.principal.session as unknown as Record<string, unknown>)['organizationId'],
    ).toBeUndefined();
  });

  it('🛑 EXPIRES like any other session', () => {
    const assessment = assessSession(
      normalizeSessionRecord(platformRow()),
      AT('2026-08-09T18:00:00.000Z'),
    );

    expect(assessment).toEqual({ usable: false, reason: 'expired' });
  });

  it('🛑 is REVOKED like any other session, and revocation still wins over expiry', () => {
    const revoked = normalizeSessionRecord(platformRow({ revokedAt: '2026-08-09T11:00:00.000Z' }));

    // ⚠️ Past its expiry AND revoked: the answer an operator asked for is "we
    // shut this down", and the ORDER that produces it is shared, 🚫 not
    // reimplemented for this principal.
    expect(assessSession(revoked, AT('2026-08-10T00:00:00.000Z'))).toEqual({
      usable: false,
      reason: 'revoked',
    });
  });

  it('🚫 a blank accountId is unreadable, 🚫 never a usable platform session', () => {
    expect(
      assessSession(
        { ...normalizeSessionRecord(platformRow()), accountId: '   ' },
        AT('2026-08-09T12:00:00.000Z'),
      ),
    ).toEqual({ usable: false, reason: 'unreadable' });
  });
});

describe('🛑 expiry and revocation have EXACTLY ONE implementation (ADR-0083 D3)', () => {
  it('walked the repository rather than trusting one path', () => {
    // ⚠️ A floor, so a walk that silently found nothing fails here rather than
    // passing the scans below vacuously.
    expect(REPO_FILES.length).toBeGreaterThan(200);
  });

  it.each([
    ["reason: 'expired'", /reason: 'expired'/],
    ["reason: 'revoked'", /reason: 'revoked'/],
  ])('decides %s in one place only, product-wide', (_label, pattern) => {
    const offenders = REPO_FILES.filter(
      (file) => !file.endsWith('.spec.ts') && !file.endsWith('.test.ts'),
    )
      .filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))))
      .map(repoRelative);

    expect(offenders).toEqual(['packages/session-store/src/session-record.ts']);
  });

  it('branches on the principal only AFTER both checks have been made', () => {
    const source = stripComments(readFileSync(join(SRC, 'session-record.ts'), 'utf8'));

    // 🛑 THE ORDER IS THE GUARANTEE. If the platform branch moved above the
    // expiry check, a platform session would be handed a principal without ever
    // being measured against the clock — and every behavioural test above would
    // still pass, because each exercises a row that IS in its window.
    const expiry = source.indexOf("reason: 'expired'");
    const revocation = source.indexOf("reason: 'revoked'");
    const branch = source.indexOf('record.organizationId === null');

    expect(expiry).toBeGreaterThan(-1);
    expect(revocation).toBeGreaterThan(-1);
    expect(branch).toBeGreaterThan(expiry);
    expect(branch).toBeGreaterThan(revocation);
  });

  it('🚫 offers no way to conjure an organization for a platform principal', () => {
    const source = stripComments(readFileSync(join(SRC, 'session-record.ts'), 'utf8'));

    // ⚠️ Each of these is one keystroke and reads as harmless; each would file a
    // platform session under a tenant, which is the substitution ADR-0082 D4
    // forbids.
    for (const banned of ['organizationId ??', 'organizationId ||', 'organizationId!']) {
      expect(`${banned}: ${source.includes(banned)}`).toBe(`${banned}: false`);
    }
  });
});
