import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  acceptVerifiedPlatformSession,
  acceptVerifiedSession,
  SessionRefusedError,
  type VerifiedPlatformSession,
} from '../index';

/**
 * ADR-0083 **D1, option B** — a principal that has no organization.
 *
 * 🛑 **THE CENTRAL ASSERTION IS AN ABSENCE.** Option A was refused because it
 * would have made `VerifiedSession.organizationId` nullable, putting an absent
 * identifier inside the module whose refusal exists because two absences
 * comparing equal read as an authorization. So the guards below assert that
 * `VerifiedSession` is **unchanged**, that the platform principal has **no**
 * organization field, and that the refusal both share has **one**
 * implementation (D3).
 *
 * ⚠️ The scans are product-wide on purpose. **A NARROW SCAN IS NOT A NARROW
 * RULE**, and that one pattern produced every audit gap this repository has
 * found.
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

const VERIFIED_SESSION = readFileSync(join(SRC, 'verified-session.ts'), 'utf8');

describe('🛑 a platform principal carries 🚫 NO organization (ADR-0083 D1)', () => {
  const session: VerifiedPlatformSession = {
    sessionId: 'session-1',
    accountId: 'account-1',
  };

  it('accepts one and returns exactly two fields', () => {
    const accepted = acceptVerifiedPlatformSession(session);

    // 🛑 THE KEY LIST, not a spot check. A field that appeared later — an
    // `organizationId`, a role, an `isAdmin` — would pass every assertion
    // about the two fields that ARE here, and fail this one.
    expect(Object.keys(accepted).sort()).toEqual(['accountId', 'sessionId']);
    expect(Object.isFrozen(accepted)).toBe(true);
  });

  it('🚫 does not carry an organization through, even when one is handed to it', () => {
    const accepted = acceptVerifiedPlatformSession({
      ...session,
      // 🛑 A caller that believes a platform session has a tenant is WRONG, and
      // the honest outcome is that the value goes nowhere — 🚫 not that it is
      // quietly kept and read by something downstream.
      organizationId: 'org-alpha',
    } as unknown as VerifiedPlatformSession);

    expect(Object.keys(accepted).sort()).toEqual(['accountId', 'sessionId']);
    expect((accepted as unknown as Record<string, unknown>)['organizationId']).toBeUndefined();
  });

  it.each(['sessionId', 'accountId'] as const)('refuses a blank %s', (field) => {
    expect(() => acceptVerifiedPlatformSession({ ...session, [field]: '   ' })).toThrow(
      SessionRefusedError,
    );
  });

  it('names the FIELD and 🚫 never the value in its refusal', () => {
    try {
      acceptVerifiedPlatformSession({ sessionId: '', accountId: 'account-secret' });
      expect.unreachable('a blank sessionId must be refused');
    } catch (error) {
      const message = (error as Error).message;

      expect(message).toContain('sessionId');
      // 🚫 ADR-0054 D3 — a refusal must not carry an identifier into a log.
      expect(message).not.toContain('account-secret');
    }
  });
});

describe('🛑 `VerifiedSession` is left BYTE-IDENTICAL by option B', () => {
  it('still requires an organization, and still refuses a blank one', () => {
    const tenant = acceptVerifiedSession({
      sessionId: 'session-1',
      organizationId: 'org-alpha',
      accountId: 'account-1',
    });

    expect(Object.keys(tenant).sort()).toEqual(['accountId', 'organizationId', 'sessionId']);
    expect(() =>
      acceptVerifiedSession({ sessionId: 's', organizationId: ' ', accountId: 'a' }),
    ).toThrow(SessionRefusedError);
  });

  it('🚫 declares no nullable organization anywhere in this package', () => {
    // 🛑 THE REFUSED OPTION, REFUSED IN A TEST. Option A is one edit away and
    // it reads as harmless. ⚠️ Comments are stripped first, or this file's own
    // explanation of the rule would satisfy a scan for it.
    const withoutComments = VERIFIED_SESSION.replace(/\/\*[\s\S]*?\*\//g, '').replace(
      /(^|[^:])\/\/.*$/gm,
      '$1',
    );

    expect(withoutComments).toContain('readonly organizationId: string;');
    expect(withoutComments).not.toContain('organizationId: string | null');
    expect(withoutComments).not.toContain('organizationId?:');
  });

  it('🚫 offers no conversion between the two principals', () => {
    // ⚠️ A helper that produced a `VerifiedSession` from a platform one would
    // undo ADR-0083 in a single function, and it would need a tenant from
    // somewhere — which is exactly the substitution ADR-0082 D4 forbids.
    for (const banned of [
      'asVerifiedSession',
      'toVerifiedSession',
      'platformSessionAsTenant',
      'organizationId ??',
    ]) {
      expect(`${banned}: ${VERIFIED_SESSION.includes(banned)}`).toBe(`${banned}: false`);
    }
  });
});

describe('🛑 the blank-identifier refusal has EXACTLY ONE implementation (ADR-0083 D3)', () => {
  it('walked the repository rather than trusting one path', () => {
    // ⚠️ A floor, so a walk that silently found nothing fails here rather than
    // passing the scan below vacuously.
    expect(REPO_FILES.length).toBeGreaterThan(200);
  });

  it('throws `SessionRefusedError` for a blank identifier from one place only', () => {
    // 🛑 PRODUCT-WIDE, 🚫 not a scan of this package. A second copy in another
    // package is exactly the drift D3 exists to prevent, and it would be
    // invisible to a scan that only looked here.
    const offenders = REPO_FILES.filter((file) => !file.endsWith('.spec.ts'))
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');

        return /new SessionRefusedError\(/.test(source);
      })
      .map((file) =>
        file
          .slice(REPO_ROOT.length + 1)
          .split('\\')
          .join('/'),
      );

    expect(offenders).toEqual(['packages/entitlement/src/verified-session.ts']);
  });

  it('both principals refuse through the same helper', () => {
    const withoutComments = VERIFIED_SESSION.replace(/\/\*[\s\S]*?\*\//g, '').replace(
      /(^|[^:])\/\/.*$/gm,
      '$1',
    );

    // ⚠️ One definition, two call sites. 🚫 Two definitions would satisfy every
    // behavioural test above and still be the drift D3 forbids.
    expect(withoutComments.match(/function refuseBlankIdentifiers/g)).toHaveLength(1);
    expect(withoutComments.match(/refuseBlankIdentifiers\(session, \[/g)).toHaveLength(2);
  });
});
