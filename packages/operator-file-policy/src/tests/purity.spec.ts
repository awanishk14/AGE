import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The policy decides about a STRING and never about the filesystem.
 *
 * ⚠️ Guard-test pattern (repo conventions): the walk must FIRST assert it found
 * files, so an empty scan can never report compliance, and comments must be
 * stripped before scanning for a banned token, or the module's own explanation
 * of the rule matches it.
 */

const SRC = join(__dirname, '..');
const REPO_ROOT = join(SRC, '..', '..', '..');

/**
 * ⚠️ Built output and installed packages are excluded by SEGMENT, not by
 * substring: a package named `distribution` must still be scanned.
 *
 * 🛑 THEY ARE PRUNED DURING THE WALK, NOT FILTERED AFTERWARDS. Filtering
 * afterwards still `stat`s every file under `node_modules` — including the
 * `vitest.config.ts.timestamp-*.mjs` files that other vitest processes create
 * and delete while this one is walking. That race made CI fail with an ENOENT
 * on a path this guard has no interest in, twice, on docs-only changes.
 */
const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const BANNED = [
  'fetch(',
  'new Date(',
  'Date.now(',
  'Math.random(',
  'performance.now(',
  'process.env',
  'process.cwd',
  'node:path',
  'node:fs',
  'localStorage',
  '@prisma/client',
  '@age/persistence',
  '@age/bif',
];

describe('@age/operator-file-policy is pure', () => {
  const files = sourceFiles(SRC);

  it('found source files to scan', () => {
    // Without this, an empty walk would silently "pass" every assertion below.
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
    // ⚠️ The rule must be importable by ANY package that reads an operator file.
    // A dependency here would make the shared policy drag a graph behind it and
    // tempt the next caller to copy the rule instead of importing it.
    const declared = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(declared.dependencies)).toEqual([]);
  });
});

/**
 * ⚠️ ADR-0054 D3 says the client record loader obeys "the same constraints as
 * D2". This asserts that "the same" means the same CODE. Two copies of one
 * fail-closed rule drift silently — the relaxed copy still passes its own
 * tests.
 */
describe('the outside-the-repository rule exists in exactly one place', () => {
  const ROOTS = ['packages', 'apps'].map((dir) => join(REPO_ROOT, dir)).filter(existsSync);

  const files = ROOTS.flatMap((root) => sourceFiles(root));

  it('excluded nothing it should have scanned, and scanned nothing excluded', () => {
    // ⚠️ The pruning now happens inside the walk, so this asserts the OUTCOME
    // rather than trusting it: a prune that swallowed the tree would fail the
    // count below, and a prune that missed would show up here.
    expect(
      files.filter((file) => file.split(/[\\/]/).some((segment) => EXCLUDED_SEGMENTS.has(segment))),
    ).toEqual([]);
  });

  it('found the repository source tree to scan', () => {
    expect(ROOTS.length).toBe(2);
    expect(files.length).toBeGreaterThan(50);
  });

  it('has one and only one implementation of the refusal', () => {
    const implementers = files.filter((file) =>
      stripComments(readFileSync(file, 'utf8')).includes('is inside the repository working tree'),
    );

    expect(implementers).toHaveLength(1);
    expect(implementers[0]).toBe(join(SRC, 'operator-file-path-policy.ts'));
  });
});
