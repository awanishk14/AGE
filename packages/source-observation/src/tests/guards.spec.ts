import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The guards ADR-0069 needs to stay true over time.
 *
 * ⚠️ Guard-test pattern (repo conventions): the walk asserts it FOUND files
 * first, so an empty scan can never report compliance; comments are stripped
 * before scanning for a banned token, or this module's own explanation of a rule
 * would match it; excluded directories are pruned DURING recursion, never
 * filtered afterwards (the #244 ENOENT).
 */

const SRC = join(__dirname, '..');
const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FILES = sourceFiles(SRC).filter((file) => !file.endsWith('.spec.ts'));

describe('@age/source-observation is pure', () => {
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
    'node:http',
    'localStorage',
    '@prisma/client',
    '@age/persistence',
    '@age/bif',
  ];

  it('found source files to scan', () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it.each(BANNED)('contains no %s', (token) => {
    let examined = 0;
    for (const file of FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8'))).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });
});

describe('the contract is source-neutral (ADR-0069 D6)', () => {
  /**
   * 🛑 `sourceSystem` IS DATA, NEVER A BRANCH. If a peer product's name ever
   * appears in this package's source, the sixth integration will need an AGE
   * release — which is the coupling the whole contract exists to prevent.
   */
  const PEER_PRODUCT_NAMES = [
    'rankops',
    'mcp-ads-server',
    'content-intelligence',
    'snara',
    'humantik',
  ];

  it.each(PEER_PRODUCT_NAMES)('names no peer product: %s', (name) => {
    let examined = 0;
    for (const file of FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8')).toLowerCase()).not.toContain(name);
    }
    expect(examined).toBe(FILES.length);
  });
});

describe('nothing here can record, score or promote (ADR-0069 D5)', () => {
  /**
   * 🛑 SOURCE ARRIVAL IS NEVER CONFIRMATION. This package produces candidates.
   * A scoring or persistence token appearing here would mean an inbound
   * observation had learned how to move a BIF field.
   */
  const BANNED = [
    'completenessScore',
    'confidenceScore',
    'sufficiency',
    'promote',
    'upsert',
    'prisma',
  ];

  it.each(BANNED)('contains no %s', (token) => {
    let examined = 0;
    for (const file of FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8')).toLowerCase()).not.toContain(
        token.toLowerCase(),
      );
    }
    expect(examined).toBe(FILES.length);
  });
});
