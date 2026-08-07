import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The guards ADR-0060 D2 needs to stay true over time.
 *
 * ⚠️ Guard-test pattern (repo conventions): the walk must FIRST assert it found
 * files, so an empty scan can never report compliance; comments are stripped
 * before scanning for a banned token, or this module's own explanation of a rule
 * matches it; and excluded directories are pruned DURING the recursion, not
 * filtered afterwards — filtering afterwards `stat`s files other test processes
 * are concurrently deleting, which is the ENOENT that failed CI twice on
 * docs-only changes (fixed in #244).
 *
 * ⚠️ Every one of these was MADE TO FAIL by mutating the thing it protects and
 * confirming it named the mutation, then restored. A guard that has never failed
 * is not evidence.
 */

const SRC = join(__dirname, '..');
const REPO_ROOT = join(SRC, '..', '..', '..');

const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist', '.next']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const ROOTS = ['packages', 'apps'].map((dir) => join(REPO_ROOT, dir)).filter(existsSync);
const REPO_FILES = ROOTS.flatMap((root) => sourceFiles(root));

describe('@age/operator-workspace performs no effect of its own', () => {
  // ⚠️ The specs and their in-memory runtime are excluded: a fake filesystem
  // built out of a `Map` is not an effect, and `node:fs` in a guard test is the
  // guard doing its job.
  const files = sourceFiles(SRC).filter(
    (file) => !file.endsWith('.spec.ts') && !file.includes(join('tests', '')),
  );

  /**
   * 🚫 `node:path` is deliberately ABSENT from this list. `join` decides about a
   * STRING and touches nothing — the same reasoning `@age/operator-file-policy`
   * already relies on. Everything that reaches the machine is below.
   */
  const BANNED = [
    'node:fs',
    'node:os',
    'node:child_process',
    'process.env',
    'process.cwd',
    'new Date(',
    'Date.now(',
    'Math.random(',
    'performance.now(',
    'fetch(',
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

  /**
   * 🚫 `@age/demo-runtime` is never imported bare.
   *
   * ⚠️ Its index exports `runAllCapabilities` and the demo fixtures. Running a
   * capability against a real business is class 3 under ADR-0057 D4, and a demo
   * fixture rendered beside a real client's name is an invented value about that
   * client. Only the `/context-readiness` subpath is reached, and it carries
   * neither. ⚠️ This guard MOVED HERE WITH THE CODE: the copy in
   * `apps/studio` now scans a tree that no longer contains the import.
   */
  it('never reaches the demo runtime index, only the readiness subpath', () => {
    // ⚠️ Matches the bare specifier only. `@age/demo-runtime/context-readiness`
    // contains the package name as a prefix, so a plain `includes` would report
    // the permitted import as a violation and the guard would be deleted.
    const bare = /from\s+'@age\/demo-runtime'/;
    let examined = 0;
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      examined += 1;
      if (bare.test(stripComments(readFileSync(file, 'utf8')))) offenders.push(file);
    }

    expect(examined).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('reaches the readiness subpath, so the guard above is about something real', () => {
    // ⚠️ Otherwise the bare-import guard would keep passing after the import
    // moved somewhere it does not scan, and report that as compliance.
    const source = readFileSync(join(SRC, 'operator-workspace.ts'), 'utf8');
    expect(source).toContain('@age/demo-runtime/context-readiness');
  });
});

/**
 * 🛑 ADR-0060 D2: the nine operations exist ONCE, and every surface calls the
 * same implementation. Duplicating them per surface is refused by name — two
 * copies of a fail-closed rule drift silently, and the copy that gets relaxed
 * still passes its own tests.
 */
describe('the operations exist in exactly one place', () => {
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

  /**
   * ⚠️ The marker is a REFUSAL SENTENCE, not a function name. A surface that
   * re-implemented an operation would have to reproduce this reasoning to keep
   * the console's behaviour, and if it did not, it is a different behaviour
   * masquerading as the same one.
   */
  it('has one and only one implementation', () => {
    const marker = 'no organization is inferred';
    const implementers = REPO_FILES.filter(
      (file) => !file.endsWith('.spec.ts') && !file.endsWith('.test.ts'),
    ).filter((file) => stripComments(readFileSync(file, 'utf8')).includes(marker));

    expect(implementers).toEqual([join(SRC, 'operator-workspace.ts')]);
  });

  /**
   * 🚫 The in-memory runtime is NOT exported from the package.
   *
   * ⚠️ A surface wired to a fake filesystem would answer every question with
   * "nothing here" — indistinguishable on screen from a business AGE looked at
   * and found empty. That is the one confusion this product exists to prevent.
   */
  it('does not export a fake runtime', () => {
    const index = readFileSync(join(SRC, 'index.ts'), 'utf8');
    expect(index).not.toContain('InMemory');
    expect(index).not.toContain('./tests/');
  });
});
