import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The guards ADR-0079 slice 1 needs to stay true over time.
 *
 * 🛑 **THE SCANS ARE PRODUCT-WIDE, 🚫 NOT PACKAGE-WIDE.** That is the single
 * lesson of the post-ADR-0078 write-boundary audit: all three gaps it found were
 * guards whose SCOPE was narrower than the RULE they asserted. "There is exactly
 * one scope decision" and "this package has no caller" are properties of the
 * PRODUCT, so they are scanned over `packages` and `apps` together.
 *
 * ⚠️ Guard-test pattern (repo conventions): the walk asserts it found files
 * FIRST, so an empty scan can never report compliance; comments are stripped
 * before scanning for a banned token; and excluded directories are pruned DURING
 * the recursion, never filtered afterwards.
 */

const SRC = join(__dirname, '..');
const PACKAGE_ROOT = join(SRC, '..');
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');

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

describe('the product-wide walk actually walked the product', () => {
  it('found both roots and many files', () => {
    expect(ROOTS.length).toBe(2);
    expect(PRODUCT_FILES.length).toBeGreaterThan(200);
  });

  it('reached files outside this package', () => {
    expect(PRODUCT_FILES.some((file) => !file.startsWith(PACKAGE_ROOT))).toBe(true);
  });
});

describe('@age/access-scope is pure', () => {
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
    expect(OWN_FILES.length).toBeGreaterThan(0);
  });

  it.each(BANNED)('contains no %s in any source file', (token) => {
    let examined = 0;
    for (const file of OWN_FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8'))).not.toContain(token);
    }
    expect(examined).toBe(OWN_FILES.length);
  });

  it('declares no dependencies at all', () => {
    const declared = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(declared.dependencies)).toEqual([]);
  });
});

/**
 * 🛑 THERE IS EXACTLY ONE SCOPE DECISION IN THE PRODUCT. The reason is the
 * `askEntitlement` reason, unchanged: **the copy that gets relaxed still passes
 * its own tests.**
 */
describe('exactly one implementation of the scope decision', () => {
  it('defines decideAccess in exactly one file, and it is this package', () => {
    const definitions = PRODUCT_FILES.filter((file) =>
      /export\s+function\s+decideAccess\s*\(/.test(stripComments(readFileSync(file, 'utf8'))),
    );

    expect(definitions).toEqual([join(SRC, 'access-decision.ts')]);
  });

  it('produces a platform scope in exactly one file, and it is this package', () => {
    const definitions = PRODUCT_FILES.filter((file) =>
      /export\s+function\s+platformScope\s*\(/.test(stripComments(readFileSync(file, 'utf8'))),
    );

    expect(definitions).toEqual([join(SRC, 'access-scope.ts')]);
  });
});

/**
 * 🛑 **EXACTLY ONE CALLER, PINNED BY NAME.**
 *
 * ⚠️ Slice 1 shipped this as *"has no caller yet"*. Slice 4 is where the caller
 * arrived, and the guard was **NARROWED, 🚫 not deleted** - deleting it to wire
 * up one screen would have discharged ADR-0079 §6's cross-tenant requirement
 * silently, which is the exact move this repo has been caught by before.
 *
 * 🛑 **THE RULE IS 'ONE COMPOSED BOUNDARY', 🚫 NOT 'FEW CALLERS'.** A second
 * importer fails this even if it is careful, because the second careful importer
 * is how the third careless one gets reviewed as normal.
 *
 * ⚠️ **THE SCAN IS PRODUCT-WIDE AND THE RULE IS PRODUCT-WIDE.** A narrow scan
 * is not a narrow rule: every source file under `packages/` and `apps/` is read,
 * and the permitted importer is named as a full path so a same-named file in
 * another app cannot inherit the permission.
 */
const PERMITTED_IMPORTER = join(REPO_ROOT, 'apps', 'studio', 'src', 'server', 'request-scope.ts');
const PERMITTED_MANIFEST = join(REPO_ROOT, 'apps', 'studio', 'package.json');

describe('@age/access-scope has exactly one caller', () => {
  it('is imported by the one composed boundary and nothing else', () => {
    const importers = PRODUCT_FILES.filter(
      (file) =>
        !file.startsWith(PACKAGE_ROOT) &&
        stripComments(readFileSync(file, 'utf8')).includes('@age/access-scope'),
    );

    expect(importers).toEqual([PERMITTED_IMPORTER]);
  });

  it('the permitted importer exists and actually decides', () => {
    // ⚠️ Otherwise the assertion above keeps passing against a path that was
    // renamed away, and reports an absent boundary as a satisfied one.
    const source = stripComments(readFileSync(PERMITTED_IMPORTER, 'utf8'));

    expect(source).toContain('decideAccess(');
    expect(source).toContain('scopeForMembership(');
  });

  it('is declared as a dependency of the one app that composes it', () => {
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
        '@age/access-scope' in (parsed.dependencies ?? {}) ||
        '@age/access-scope' in (parsed.devDependencies ?? {})
      );
    });

    expect(depending).toEqual([PERMITTED_MANIFEST]);
  });
});

/**
 * 🚫 A ROLE NAME NEVER DECIDES ANYTHING. Bundles resolve to atoms once, at scope
 * construction; the decision reads atoms only.
 */
describe('the decision reads no role name', () => {
  it('never mentions a bundle name in the deciding module', () => {
    const decision = stripComments(readFileSync(join(SRC, 'access-decision.ts'), 'utf8'));
    for (const bundle of ['platform-operator', 'agency-operator', 'client-viewer']) {
      expect(decision).not.toContain(bundle);
    }
    expect(decision).not.toContain('isAdmin');
    expect(decision).not.toContain('ROLE_BUNDLES');
  });
});
