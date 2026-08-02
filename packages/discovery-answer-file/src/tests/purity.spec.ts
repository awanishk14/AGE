import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ADR-0054 D1/D2 — this package DECIDES; it never performs the effect.
 *
 * ⚠️ Guard-test pattern (repo conventions): the walk must FIRST assert it found
 * files, so an empty scan can never report compliance, and comments are
 * stripped before scanning for a banned token, or a file's own explanation of
 * the rule matches it.
 *
 * ⚠️ `node:fs` is banned in `src` even though this package is *about* a file:
 * the read is injected by the caller. This spec is itself the exception and is
 * excluded from the scan, along with every other `.spec.ts`.
 */

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
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
  'node:fs',
  'localStorage',
  '@prisma/client',
  '@age/persistence',
  '@age/bif',
];

describe('@age/discovery-answer-file is pure', () => {
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

  it('declares only the workspace dependencies it needs', () => {
    const declared = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(declared.dependencies).sort()).toEqual([
      '@age/business-discovery-contracts',
      '@age/operator-file-policy',
      'zod',
    ]);
  });

  it('performs no path resolution that could read the working directory', () => {
    // `path.resolve` on a relative input silently consults `cwd`. D2 forbids a
    // "search of the working directory", so the policy refuses relative paths
    // instead of resolving them.
    let examined = 0;
    for (const file of files) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8'))).not.toContain('resolve(');
    }
    expect(examined).toBe(files.length);
  });
});
