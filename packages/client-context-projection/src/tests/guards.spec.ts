import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The guards ADR-0069 deliverable 7 needs to stay true over time.
 *
 * ⚠️ Guard-test pattern (repo conventions): the walk asserts it FOUND files
 * first, so an empty scan can never report compliance; comments are stripped
 * before scanning for a banned token, or this package's own explanation of a
 * rule would match it; excluded directories are pruned DURING recursion.
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

describe('@age/client-context-projection is pure', () => {
  const BANNED = [
    'fetch(',
    'new Date(',
    'Date.now(',
    'Math.random(',
    'performance.now(',
    'process.env',
    'node:fs',
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

describe('🚫 nothing here transports, and nothing here authorizes', () => {
  /**
   * 🛑 THE PROJECTION IS NOT THE SURFACE. Deliverable 7 says "entitled on
   * read", and the surface is deliberately absent until token verification
   * exists — so 🚫 this package must not grow a session, a token, a route or a
   * server. A projection that could answer a caller directly would be an
   * inbound endpoint arriving without the entitlement question in front of it.
   */
  const BANNED = ['express', 'createServer', 'listen(', 'token', 'session', 'cookie', 'bearer'];

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

describe('the projection is source-neutral (ADR-0069 D6)', () => {
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
