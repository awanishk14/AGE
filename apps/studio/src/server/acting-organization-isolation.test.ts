import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **THE CHOICE COOKIE IS READ IN EXACTLY ONE PLACE** — ADR-0085.
 *
 * 🛑 **WHY THIS GUARD AND NOT A COMMENT.** The acting-organization cookie is
 * harmless only because `acting-organization.ts` checks it against the closed
 * set the HOST configured before it means anything. A **second** reader —
 * somewhere that wants "the current organization" without wanting the ceremony
 * — would be a caller-supplied organization identifier trusted on its face, and
 * that is the one failure this whole design exists to make impossible.
 *
 * ⚠️ **PRODUCT-WIDE, 🚫 NOT PACKAGE-WIDE.** A scan narrower than the rule it
 * asserts is the single pattern that produced every audit gap on this track —
 * so this walks `packages/` and `apps/`, exactly as the platform-scope guard
 * does. ⚠️ It is a SOURCE-TEXT guard: it proves what may be REACHED, 🚫 not
 * what runs.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

/** ⚠️ Paths are compared in POSIX form so the allowlist reads the same on both. */
const WINDOWS_SEPARATOR = String.fromCharCode(92);
const EXCLUDED = new Set(['node_modules', 'dist', '.nx', '.next', '.git']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED.has(entry)) return [];

    const full = join(dir, entry);

    if (statSync(full).isDirectory()) return sourceFiles(full);

    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const SCANNED = ['packages', 'apps'].flatMap((top) => sourceFiles(join(REPO_ROOT, top)));

/**
 * 🛑 **THE FILES ALLOWED TO NAME THE READER, EACH FOR A STATED REASON.** 🚫
 * Nothing is added here to make a screen work.
 */
const MAY_READ_THE_CHOICE: ReadonlyMap<string, string> = new Map([
  [
    'packages/session-cookie/src/acting-organization-cookie.ts',
    'It DEFINES the reader. The parsing lives in one module, as the session cookie does.',
  ],
  ['packages/session-cookie/src/index.ts', 'It re-exports the reader, and 🚫 does not call it.'],
  [
    'packages/session-cookie/src/tests/acting-organization-cookie.spec.ts',
    'It exercises the reader.',
  ],
  [
    'apps/studio/src/server/acting-organization.ts',
    'THE ONE CALLER. It is where the offered value is compared against the closed set the host ' +
      'configured — the comparison that makes the cookie harmless.',
  ],
  ['apps/studio/src/server/acting-organization-isolation.test.ts', 'This guard.'],
]);

describe('🛑 the acting-organization cookie is read at EXACTLY ONE call site (ADR-0085)', () => {
  it('⚠️ scanned a real tree', () => {
    // 🚫 An empty scan must never be able to report compliance.
    expect(SCANNED.length).toBeGreaterThan(200);
  });

  it('🚫 is named by no module that has not been listed above', () => {
    const offenders = SCANNED.filter((file) =>
      stripComments(readFileSync(file, 'utf8')).includes('readActingOrganizationCookie'),
    )
      .map((file) => relative(REPO_ROOT, file).split(WINDOWS_SEPARATOR).join('/'))
      .filter((file) => !MAY_READ_THE_CHOICE.has(file));

    expect(
      offenders,
      'These modules read the acting-organization cookie. It is a CHOICE, not a credential, and ' +
        'it is only safe because exactly one module compares it against the organizations the ' +
        'host configured. A second reader is a caller-supplied organization identifier trusted ' +
        'on its face.',
    ).toEqual([]);
  });

  it('🚫 lists no file that has since been deleted', () => {
    const present = new Set(
      SCANNED.map((file) => relative(REPO_ROOT, file).split(WINDOWS_SEPARATOR).join('/')),
    );
    const stale = [...MAY_READ_THE_CHOICE.keys()].filter((file) => !present.has(file));

    // ⚠️ An allowlist entry for a file that no longer exists is a guard that
    // stopped scanning something and did not say so.
    expect(stale).toEqual([]);
  });
});

describe('🛑 signing out forgets the choice as well (ADR-0085)', () => {
  const source = stripComments(
    readFileSync(join(__dirname, '..', 'app', 'sign-out', 'route.ts'), 'utf8'),
  );

  it('expires it', () => {
    expect(
      source,
      'Sign-out must expire the acting-organization cookie. A choice left behind is a stale ' +
        'answer waiting for whoever signs in next at the same browser — they would be placed ' +
        'somewhere without being asked.',
    ).toContain('expireActingOrganizationCookie()');
  });

  it('🛑 still revokes the row first, and still expires the SESSION cookie', () => {
    // ⚠️ 🚫 The choice cookie must not have displaced either half of the actual
    // logout. Forgetting where you stood is not signing out (ADR-0074 D3).
    expect(source).toContain('endRequestSession()');
    expect(source).toContain('expireSessionCookie()');
    expect(source.indexOf('endRequestSession()')).toBeLessThan(
      source.indexOf('expireSessionCookie()'),
    );
  });
});
