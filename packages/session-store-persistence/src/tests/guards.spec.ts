import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ⚠️ Guard-test pattern: the walk asserts it found files, comments are stripped
 * before scanning (or a file's own explanation of a rule matches it), and every
 * count is asserted AFTER the loop.
 */

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === 'dist') return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FILES = sourceFiles(SRC);
const sources = () =>
  FILES.map((file) => [file, stripComments(readFileSync(file, 'utf8'))] as const);

describe('@age/session-store-persistence declares no schema and generates nothing', () => {
  it('found source files to scan', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(4);
  });

  it.each([
    '@prisma/client',
    'PrismaClient',
    'node:fs',
    'node:crypto',
    'fetch(',
    'Date.now(',
    'Math.random(',
    'process.env',
    'randomBytes',
    'randomUUID',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const [file, source] of sources()) {
      examined += 1;
      expect(source, file).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });

  it('never constructs a clock', () => {
    let examined = 0;
    for (const [file, source] of sources()) {
      examined += 1;
      expect(source, file).not.toMatch(/new Date\(/);
    }
    expect(examined).toBe(FILES.length);
  });
});

describe('🛑 VERIFICATION IS NOT ISSUANCE — the write it would need does not exist', () => {
  it.each([
    'create',
    'createMany',
    'update',
    'updateMany',
    'upsert',
    'delete',
    'deleteMany',
    'executeRawUnsafe',
    'queryRawUnsafe',
  ])('offers no %s anywhere in the package', (method) => {
    let examined = 0;
    for (const [file, source] of sources()) {
      examined += 1;
      expect(source, file).not.toContain(method);
    }
    expect(examined).toBe(FILES.length);
  });

  it('🚫 offers no findMany either — listing sessions is the surface §0.1c refuses', () => {
    let examined = 0;
    for (const [file, source] of sources()) {
      examined += 1;
      expect(source, file).not.toContain('findMany');
    }
    expect(examined).toBe(FILES.length);
  });
});

describe('🚫 the session decisions have exactly one implementation, and it is elsewhere', () => {
  it.each([
    'timingSafeEqual',
    'createHash',
    'expiresAt',
    'revokedAt',
    'assessSession',
    'normalizeSessionRecord',
  ])('does not re-decide %s here', (token) => {
    // 🛑 The copy that gets relaxed still passes its own tests. Hashing,
    // expiry, revocation and row validation live in `@age/session-store`, and
    // this package is deliberately incapable of second-guessing any of them.
    let examined = 0;
    for (const [file, source] of sources()) {
      examined += 1;
      expect(source, file).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });
});

describe('🚫 no provisioning vocabulary reaches this package', () => {
  it.each(['login', 'signIn', 'signin', 'provision', 'issueSession', 'mintToken', 'logout'])(
    'contains no %s',
    (token) => {
      let examined = 0;
      for (const [file, source] of sources()) {
        examined += 1;
        expect(source.toLowerCase(), file).not.toContain(token.toLowerCase());
      }
      expect(examined).toBe(FILES.length);
    },
  );
});
