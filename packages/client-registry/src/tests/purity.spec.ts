import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ADR-0053 D9 — the package is a lookup, not a loader.
 *
 * ⚠️ Guard-test pattern (see the repo conventions): the walk must FIRST assert
 * it found files, so an empty scan can never report compliance, and comments
 * must be stripped before scanning for a banned token, or a file's own
 * explanation of the rule matches it.
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
  'node:fs',
  'localStorage',
  '@prisma/client',
  '@age/persistence',
  '@age/bif',
];

describe('@age/client-registry is pure', () => {
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

  it('imports @age/capability-kit and zod, and nothing else from the workspace', () => {
    const declared = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(declared.dependencies).sort()).toEqual(['@age/capability-kit', 'zod']);
  });
});
