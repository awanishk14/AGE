import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The guards that keep this package READ-ONLY.
 *
 * ⚠️ **THE SCAN IS THE PACKAGE, BECAUSE THE RULE IS THE PACKAGE.** "Nothing here
 * writes" is a property of THIS package — the product-wide claim, that issuance
 * exists at exactly one module, is asserted where it belongs, in
 * `@age/session-issuance-persistence`. 🛑 A narrow scan is not a narrow rule,
 * and 🚫 a scan wider than its rule is as wrong as one narrower.
 *
 * ⚠️ Guard-test pattern: the walk asserts it found files FIRST, so an empty scan
 * can never report compliance, and comments are stripped before scanning so that
 * a doc block naming a banned verb does not fail its own file.
 */

const SRC = join(__dirname, '..');
const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist', '.next', '.turbo']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

const OWN_FILES = sourceFiles(SRC).filter((file) => !file.endsWith('.spec.ts'));
const sources = OWN_FILES.map(
  (file) =>
    [
      file,
      readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1'),
    ] as const,
);

describe('the walk actually walked', () => {
  it('found every module of this package', () => {
    expect(OWN_FILES.length).toBeGreaterThanOrEqual(4);
  });
});

describe('🛑 AGE MINTS NOTHING — this package cannot provision anybody', () => {
  it.each(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'])(
    '🚫 names no `%s` anywhere',
    (verb) => {
      // 🛑 `accounts` and `account_memberships` hold GRANT SELECT and nothing
      // else. ADR-0079 overturned the refusal on issuing SESSIONS and 🚫 nothing
      // else, so a provisioning path here would need its own ADR **and** its own
      // migration — 🚫 not a widened delegate.
      for (const [file, source] of sources) {
        expect(`${file}: ${source.includes(`${verb}(`)}`).toBe(`${file}: false`);
      }
    },
  );
});

describe('🚫 it reaches for nothing it was not given', () => {
  it.each([
    ['@prisma/client', '@prisma/client'],
    ['$executeRawUnsafe', '$executeRawUnsafe'],
    ['$queryRaw', '$queryRaw'],
    ['a clock', 'Date.now'],
    ['randomness', 'node:crypto'],
    ['the environment', 'process.env'],
    ['the network', 'fetch('],
  ])('🚫 names no %s', (_label, token) => {
    for (const [file, source] of sources) {
      expect(`${file}: ${source.includes(token)}`).toBe(`${file}: false`);
    }
  });
});

describe('🛑 the scope is never optional and never defaulted', () => {
  it('sets `age.organization_id` in exactly one file', () => {
    const setters = sources.filter(([, source]) => source.includes('age.organization_id'));

    // 🛑 One `set_config` line. Two is how the two drift, and the copy that gets
    // relaxed still passes its own tests.
    expect(setters.map(([file]) => file.split(/[\\/]/).pop())).toEqual([
      'directory-scope-runner.ts',
    ]);
  });

  it('🚫 offers no way to run unscoped', () => {
    for (const [file, source] of sources) {
      expect(`${file}: ${source.includes('organizationId?')}`).toBe(`${file}: false`);
      expect(`${file}: ${/organizationId\s*[|&]{2}/.test(source)}`).toBe(`${file}: false`);
    }
  });
});

describe('🚫 it decides nothing about admission', () => {
  it.each(['admitted', 'refused', 'decideSignIn'])(
    '🚫 never mentions `%s` — that answer is `@age/sign-in-directory`.s, always',
    (token) => {
      for (const [file, source] of sources) {
        expect(`${file}: ${source.includes(token)}`).toBe(`${file}: false`);
      }
    },
  );

  it('🚫 and never branches on a scope kind', () => {
    for (const [file, source] of sources) {
      expect(`${file}: ${source.includes("'agency'")}`).toBe(`${file}: false`);
      expect(`${file}: ${source.includes("'platform'")}`).toBe(`${file}: false`);
      expect(`${file}: ${source.includes("'client'")}`).toBe(`${file}: false`);
    }
  });
});
