import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The three guards ADR-0058 D8 item 1 needs to stay true over time.
 *
 * ⚠️ Guard-test pattern (repo conventions): the walk must FIRST assert it found
 * files, so an empty scan can never report compliance; comments are stripped
 * before scanning for a banned token, or this module's own explanation of a rule
 * matches it; and excluded directories are pruned DURING the recursion, not
 * filtered afterwards — filtering afterwards `stat`s files other vitest
 * processes are concurrently deleting, which is the ENOENT that failed CI twice
 * on docs-only changes (fixed in #244).
 */

const SRC = join(__dirname, '..');
const REPO_ROOT = join(SRC, '..', '..', '..');

const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
  });
}

function packageManifests(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) return [];
    const manifest = join(full, 'package.json');
    return [...(existsSync(manifest) ? [manifest] : []), ...packageManifests(full)];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const ROOTS = ['packages', 'apps'].map((dir) => join(REPO_ROOT, dir)).filter(existsSync);
const REPO_FILES = ROOTS.flatMap((root) => sourceFiles(root));

describe('@age/entitlement is pure', () => {
  const files = sourceFiles(SRC).filter((file) => !file.endsWith('.spec.ts'));

  const BANNED = [
    'fetch(',
    'new Date(',
    'Date.now(',
    'Math.random(',
    'performance.now(',
    'process.env',
    'process.cwd',
    'node:fs',
    'node:path',
    'localStorage',
    '@prisma/client',
    '@age/persistence',
    '@age/bif',
  ];

  it('found source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(BANNED)('contains no %s in any source file', (token) => {
    let examined = 0;
    for (const file of files) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8'))).not.toContain(token);
    }
    expect(examined).toBe(files.length);
  });

  it('declares no dependencies at all', () => {
    const declared = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(declared.dependencies)).toEqual([]);
  });
});

/**
 * 🛑 ADR-0058 D2: there is EXACTLY ONE implementation of the entitlement
 * question. Two copies of one fail-closed rule drift silently, and the relaxed
 * copy still passes its own tests.
 */
describe('the entitlement question exists in exactly one place', () => {
  it('excluded nothing it should have scanned, and scanned nothing excluded', () => {
    expect(
      REPO_FILES.filter((file) =>
        file.split(/[\\/]/).some((segment) => EXCLUDED_SEGMENTS.has(segment)),
      ),
    ).toEqual([]);
  });

  it('found the repository source tree to scan', () => {
    expect(ROOTS.length).toBe(2);
    expect(REPO_FILES.length).toBeGreaterThan(50);
  });

  it('has one and only one implementation', () => {
    // ⚠️ Specs are excluded HERE and only here: a test that pins the words is
    // not a second implementation of the rule. 🚫 They stay in the no-caller
    // scan below, where a spec importing this package WOULD be a caller.
    const implementers = REPO_FILES.filter(
      (file) => !file.endsWith('.spec.ts') && !file.endsWith('.test.ts'),
    ).filter((file) =>
      stripComments(readFileSync(file, 'utf8')).includes('no authenticated identity exists'),
    );

    expect(implementers).toHaveLength(1);
    expect(implementers[0]).toBe(join(SRC, 'entitlement-question.ts'));
  });

  it('carries none of the bypasses ADR-0058 D2 refuses by name', () => {
    // ⚠️ WIDENED IN THE ADR-0061 A3 SLICE from one file to every source file in
    // the package. A second module now exists, and a bypass added to the newer
    // one would have passed a guard that only ever read the older one.
    const scanned = sourceFiles(SRC).filter((file) => !file.endsWith('.spec.ts'));

    expect(scanned.length).toBeGreaterThanOrEqual(3);

    for (const file of scanned) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const bypass of [
        'allowAll',
        'SYSTEM_PRINCIPAL',
        'entitlementOrDefault',
        'devMode',
        'bypass',
        'OperatorPrincipal',
        'isAdmin',
        'role',
      ]) {
        expect(source, `${file} must not contain ${bypass}`).not.toContain(bypass);
      }
    }
  });

  it('enumerates every arm and adds no default (ADR-0061 A3)', () => {
    // 🛑 A `default` arm silences the compile error that adding an
    // authentication kind is SUPPOSED to cause. A3 refuses it by name, so the
    // absence is asserted rather than assumed.
    const source = stripComments(readFileSync(join(SRC, 'entitlement-question.ts'), 'utf8'));

    expect(source).not.toMatch(/\bdefault\s*:/);
    expect(source).toContain("case 'verified-session':");
    expect(source).toContain("case 'none':");
  });

  it('issues, stores and verifies no session (ADR-0061 A2)', () => {
    // 🚫 A session store is entirely effects, and this package performs none.
    // The purity scan above already bans the I/O; these ban the VOCABULARY, so
    // that a store cannot begin as "just the pure part" of one.
    for (const file of sourceFiles(SRC).filter((file) => !file.endsWith('.spec.ts'))) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const token of ['argon2', 'bcrypt', 'password', 'cookie', 'token', 'issueSession']) {
        expect(source.toLowerCase(), `${file} must not contain ${token}`).not.toContain(
          token.toLowerCase(),
        );
      }
    }
  });
});

/**
 * 🛑 ADR-0058 D8: acceptance authorizes the question "with no caller". This is
 * that sentence made checkable.
 *
 * ⚠️ When a caller is eventually authorized, it will be by an ADR that says so —
 * and deleting this guard is then a deliberate, reviewable act rather than an
 * omission nobody noticed.
 */
describe('@age/entitlement has no caller', () => {
  const OUTSIDE = REPO_FILES.filter((file) => !file.startsWith(join(SRC, '..')));

  it('found files outside this package to scan', () => {
    expect(OUTSIDE.length).toBeGreaterThan(50);
    expect(OUTSIDE.length).toBeLessThan(REPO_FILES.length);
  });

  it('is imported by nothing', () => {
    let examined = 0;
    const importers: string[] = [];
    for (const file of OUTSIDE) {
      examined += 1;
      if (stripComments(readFileSync(file, 'utf8')).includes('@age/entitlement')) {
        importers.push(file);
      }
    }
    expect(examined).toBe(OUTSIDE.length);
    expect(importers).toEqual([]);
  });

  it('is depended on by no package manifest', () => {
    const manifests = ROOTS.flatMap((root) => packageManifests(root));

    expect(manifests.length).toBeGreaterThan(10);
    for (const manifest of manifests) {
      if (manifest === join(SRC, '..', 'package.json')) continue;
      expect(readFileSync(manifest, 'utf8')).not.toContain('@age/entitlement');
    }
  });
});
