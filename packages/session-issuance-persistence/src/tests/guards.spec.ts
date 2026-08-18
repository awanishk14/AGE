import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The guards ADR-0079 slice 2 needs to stay true over time.
 *
 * 🛑 **THE SCANS THAT ASSERT A PRODUCT PROPERTY ARE PRODUCT-WIDE.** "Issuance
 * exists at exactly one named module" is a property of the PRODUCT, so it is
 * scanned over `packages` and `apps` together — ⚠️ **a narrow scan is not a
 * narrow rule**, which is the single lesson of the post-ADR-0078 write-boundary
 * audit and the reason PRs #377/#378 exist.
 *
 * ⚠️ Guard-test pattern: the walk asserts it found files FIRST, so an empty scan
 * can never report compliance; comments are stripped before scanning for a
 * banned token; excluded directories are pruned DURING the recursion; and every
 * exemption is asserted POSITIVELY as well as negatively.
 */

const SRC = join(__dirname, '..');
const PACKAGE_ROOT = join(SRC, '..');
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
const ISSUANCE_MODULE = join(SRC, 'operator-session-issuance.ts');

const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist', '.next', '.turbo']);

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
const PRODUCT_FILES = ROOTS.flatMap((root) => sourceFiles(root));
const OWN_FILES = sourceFiles(SRC).filter((file) => !file.endsWith('.spec.ts'));
const sources = () =>
  OWN_FILES.map((file) => [file, stripComments(readFileSync(file, 'utf8'))] as const);

describe('the product-wide walk actually walked the product', () => {
  it('found both roots and many files', () => {
    expect(ROOTS.length).toBe(2);
    expect(PRODUCT_FILES.length).toBeGreaterThan(200);
  });

  it('reached files outside this package', () => {
    expect(PRODUCT_FILES.some((file) => !file.startsWith(PACKAGE_ROOT))).toBe(true);
  });
});

describe('@age/session-issuance-persistence declares no schema and generates nothing', () => {
  it('found source files to scan', () => {
    expect(OWN_FILES.length).toBeGreaterThanOrEqual(2);
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
    'executeRawUnsafe',
    'queryRawUnsafe',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const [file, source] of sources()) {
      examined += 1;
      expect(source, file).not.toContain(token);
    }
    expect(examined).toBe(OWN_FILES.length);
  });

  it('never constructs a clock', () => {
    // 🛑 The issuing instant is a PARAMETER. A package that reads its own clock
    // cannot be tested against the minute a session expires.
    let examined = 0;
    for (const [file, source] of sources()) {
      examined += 1;
      expect(source, file).not.toMatch(/new Date\(/);
    }
    expect(examined).toBe(OWN_FILES.length);
  });
});

/**
 * 🛑 **ISSUING IS NOT EXTENDING, REPOINTING, RE-TENANTING OR ERASING.** The
 * grant is `INSERT`; the only other write AGE holds is the column-scoped
 * `UPDATE ("revoked_at")` in a different package. This package must ask for
 * neither of the others.
 */
describe('🛑 the package can START a session and nothing else', () => {
  it.each(['update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'createMany'])(
    'names no %s anywhere in the package',
    (method) => {
      let examined = 0;
      for (const [file, source] of sources()) {
        examined += 1;
        expect(source, file).not.toContain(method);
      }
      expect(examined).toBe(OWN_FILES.length);
    },
  );

  it('🚫 offers no read either — verification lives in the read package', () => {
    for (const [file, source] of sources()) {
      expect(source, file).not.toContain('findUnique');
      expect(source, file).not.toContain('findMany');
    }
  });

  it('names `create` in the issuance module and NOWHERE else in the package', () => {
    let examined = 0;
    let named = 0;

    for (const [file, source] of sources()) {
      examined += 1;
      if (file === ISSUANCE_MODULE) {
        named += source.includes('create') ? 1 : 0;
        continue;
      }
      expect(source, file).not.toContain('create');
    }

    expect(examined).toBe(OWN_FILES.length);
    // ⚠️ Asserted POSITIVELY too: an exemption whose file stopped containing the
    // thing it was exempted for is an exemption nobody would notice had become
    // a hole.
    expect(named).toBe(1);
  });
});

/**
 * 🚫 **THE DECISIONS ARE ELSEWHERE AND THIS PACKAGE CANNOT SECOND-GUESS THEM.**
 * Hashing, the lifetime ceiling and the row shape are `@age/session-store`'s,
 * which is the one implementation of each. 🛑 The copy that gets relaxed still
 * passes its own tests.
 */
describe('🚫 it re-decides nothing about a session', () => {
  it.each([
    'createHash',
    'sha256',
    'timingSafeEqual',
    'MAXIMUM_SESSION_LIFETIME_SECONDS',
    'assessSession',
    'normalizeSessionRecord',
  ])('does not re-decide %s here', (token) => {
    let examined = 0;
    for (const [file, source] of sources()) {
      examined += 1;
      expect(source, file).not.toContain(token);
    }
    expect(examined).toBe(OWN_FILES.length);
  });

  it('🚫 puts no scope, bundle or admin flag on the issued row (ADR-0062 D3)', () => {
    // 🛑 Scope is read from `account_memberships` per request (ADR-0079 §2). A
    // field on the session would make the credential authoritative again, and
    // a membership withdrawn today would keep working until sign-out.
    for (const [file, source] of sources()) {
      for (const token of ['isAdmin', 'roleBundle', 'capabilit', 'permission', 'platformScope']) {
        expect(source, file).not.toContain(token);
      }
    }
  });
});

/**
 * 🛑 **ADR-0079 §6 SLICE 2's NAMED GUARD: ISSUANCE EXISTS AT EXACTLY ONE
 * MODULE.** The sibling guard in `@age/session-store-persistence` asserts that
 * no OTHER file performs a session write; this one asserts that the entry point
 * itself has not been copied. Two functions with this name is how a second
 * issuance path arrives while every existing test stays green.
 */
describe('exactly one issuance entry point in the product', () => {
  it('defines operatorSessionIssuance in exactly one file', () => {
    const definitions = PRODUCT_FILES.filter((file) =>
      /export\s+function\s+operatorSessionIssuance\s*\(/.test(
        stripComments(readFileSync(file, 'utf8')),
      ),
    );

    expect(definitions).toEqual([ISSUANCE_MODULE]);
  });

  it('defines issuedSessionRecord in exactly one file, and it is the pure package', () => {
    const definitions = PRODUCT_FILES.filter((file) =>
      /export\s+function\s+issuedSessionRecord\s*\(/.test(
        stripComments(readFileSync(file, 'utf8')),
      ),
    );

    expect(definitions).toEqual([
      join(REPO_ROOT, 'packages', 'session-store', 'src', 'session-issuance.ts'),
    ]);
  });
});

/**
 * 🚫 **THIS PACKAGE HAS NO CALLER YET, DELIBERATELY.** Sign-in is slice 3, and
 * it is where a token is first minted. ⚠️ The deployed console is deliberately
 * unreachable until then, and 🚫 wiring this up early is not the way to open it.
 */
describe('@age/session-issuance-persistence has no caller yet', () => {
  it('is imported nowhere outside itself', () => {
    const importers = PRODUCT_FILES.filter(
      (file) =>
        !file.startsWith(PACKAGE_ROOT) &&
        stripComments(readFileSync(file, 'utf8')).includes('@age/session-issuance-persistence'),
    );

    expect(importers).toEqual([]);
  });

  it('is declared as a dependency of no other package', () => {
    function manifests(dir: string): string[] {
      return readdirSync(dir).flatMap((entry) => {
        if (EXCLUDED_SEGMENTS.has(entry)) return [];
        const full = join(dir, entry);
        if (!statSync(full).isDirectory()) return [];
        const manifest = join(full, 'package.json');
        return [...(existsSync(manifest) ? [manifest] : []), ...manifests(full)];
      });
    }

    const all = ROOTS.flatMap((root) => manifests(root));
    expect(all.length).toBeGreaterThan(10);

    const depending = all.filter((manifest) => {
      if (manifest.startsWith(PACKAGE_ROOT)) return false;
      const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      return (
        '@age/session-issuance-persistence' in (parsed.dependencies ?? {}) ||
        '@age/session-issuance-persistence' in (parsed.devDependencies ?? {})
      );
    });

    expect(depending).toEqual([]);
  });
});
