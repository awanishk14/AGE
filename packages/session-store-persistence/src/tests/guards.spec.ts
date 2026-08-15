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

/**
 * 🛑 **THE ONE FILE ALLOWED TO NAME A WRITE** — ADR-0074 §7 slice 2.
 *
 * ⚠️ **WHAT CHANGED AND WHAT DID NOT.** This package used to contain no write
 * vocabulary at all, because the table held `GRANT SELECT` alone. ADR-0074 D3
 * added a requirement the old shape could not meet — *"a logout that only clears
 * the cookie is not a logout"* — so the table now also holds
 * `GRANT UPDATE ("revoked_at")`, a COLUMN grant, and exactly one module names it.
 *
 * 🚫 **THE EXEMPTION IS A FILE, NOT A TOKEN.** Every other file in the package is
 * still scanned for every write verb, and this one is still scanned for all the
 * verbs it has no business naming. 🛑 **`create`, `upsert` and `delete` are
 * refused EVERYWHERE, this file included** — AGE can end a session it never
 * issued, and 🚫 it still cannot issue one.
 */
const REVOCATION_MODULE = join(SRC, 'operator-session-revocation.ts');

describe('🛑 VERIFICATION IS NOT ISSUANCE — the write it would need does not exist', () => {
  it.each([
    'create',
    'createMany',
    'upsert',
    'delete',
    'deleteMany',
    'executeRawUnsafe',
    'queryRawUnsafe',
  ])('offers no %s anywhere in the package, revocation included', (method) => {
    let examined = 0;
    for (const [file, source] of sources()) {
      examined += 1;
      expect(source, file).not.toContain(method);
    }
    expect(examined).toBe(FILES.length);
  });

  it.each(['update', 'updateMany'])(
    'names %s in the revocation module and NOWHERE else',
    (method) => {
      let examined = 0;
      let named = 0;

      for (const [file, source] of sources()) {
        examined += 1;
        if (file === REVOCATION_MODULE) {
          named += source.includes(method) ? 1 : 0;
          continue;
        }
        expect(source, file).not.toContain(method);
      }

      expect(examined).toBe(FILES.length);
      // ⚠️ Asserted POSITIVELY as well: an exemption whose file stopped
      // containing the thing it was exempted for is an exemption nobody would
      // notice had become a hole.
      expect(named).toBe(1);
    },
  );

  it('🛑 the revocation module writes ONE column and names no other', () => {
    const source = stripComments(readFileSync(REVOCATION_MODULE, 'utf8'));

    expect(source).toContain('revokedAt');
    // 🚫 Extending a session, repointing one, re-tenanting one. None of the
    // three columns is even mentioned, so none can be sent.
    expect(source).not.toContain('expiresAt');
    expect(source).not.toContain('tokenHash');
    expect(source).not.toContain('accountId');
    expect(source).not.toContain('issuedAt');
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

  it('🚫 names `revokedAt` only where the one write lives — and decides nothing about it', () => {
    // ⚠️ `revokedAt` left the list above because the revocation module must name
    // the column it sets. 🛑 It is still refused everywhere ELSE, and what the
    // column MEANS — whether a session is usable — is still `assessSession`'s
    // alone, in `@age/session-store`, asserted by that name staying banned here.
    let examined = 0;
    let named = 0;

    for (const [file, source] of sources()) {
      examined += 1;
      if (file === REVOCATION_MODULE) {
        named += source.includes('revokedAt') ? 1 : 0;
        continue;
      }
      expect(source, file).not.toContain('revokedAt');
    }

    expect(examined).toBe(FILES.length);
    expect(named).toBe(1);
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
