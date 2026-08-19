import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The guards that keep this package READ-ONLY.
 *
 * ⚠️ **THE SCAN IS THE PACKAGE, BECAUSE THE RULE IS THE PACKAGE.** "Nothing here
 * writes" is a property of THIS package — the product-wide claim, that issuance
 * exists at exactly one module, is asserted where it belongs, in
 * `@age/session-issuance-persistence`. 🛑 A narrow scan is not a narrow rule,
 * and 🚫 a scan wider than its rule is as wrong as one narrower.
 *
 * ⚠️ **ONE BLOCK BELOW IS PRODUCT-WIDE, AND SAYS SO.** "This package is
 * reachable only from a composition door" is a property of the PRODUCT, so it is
 * scanned over `packages` and `apps` together - the same shape
 * `@age/session-issuance-persistence` uses for its own one-door rule.
 *
 * ⚠️ Guard-test pattern: the walk asserts it found files FIRST, so an empty scan
 * can never report compliance, and comments are stripped before scanning so that
 * a doc block naming a banned verb does not fail its own file.
 */

const SRC = join(__dirname, '..');
const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist', '.next', '.turbo']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

const OWN_FILES = sourceFiles(SRC).filter((file) => !file.endsWith('.spec.ts'));
const sources = OWN_FILES.map(
  (file) =>
    [
      file,
      readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1'),
    ] as const,
);

describe('the walk actually walked', () => {
  it('found every module of this package', () => {
    expect(OWN_FILES.length).toBeGreaterThanOrEqual(6);
  });
});

describe('🛑 AGE MINTS NOTHING — this package cannot provision anybody', () => {
  it.each(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'])(
    '🚫 names no `%s` anywhere',
    (verb) => {
      // 🛑 `accounts` and `account_memberships` hold GRANT SELECT and nothing
      // else. ADR-0079 overturned the refusal on issuing SESSIONS and 🚫 nothing
      // else, so a provisioning path here would need its own ADR **and** its own
      // migration — 🚫 not a widened delegate.
      for (const [file, source] of sources) {
        expect(`${file}: ${source.includes(`${verb}(`)}`).toBe(`${file}: false`);
      }
    },
  );
});

describe('🚫 it reaches for nothing it was not given', () => {
  it.each([
    ['@prisma/client', '@prisma/client'],
    ['$executeRawUnsafe', '$executeRawUnsafe'],
    ['$queryRaw', '$queryRaw'],
    ['a clock', 'Date.now'],
    ['randomness', 'node:crypto'],
    ['the environment', 'process.env'],
    ['the network', 'fetch('],
  ])('🚫 names no %s', (_label, token) => {
    for (const [file, source] of sources) {
      expect(`${file}: ${source.includes(token)}`).toBe(`${file}: false`);
    }
  });
});

describe('🛑 the scope is never optional and never defaulted', () => {
  it('sets `age.organization_id` in exactly one file', () => {
    const setters = sources.filter(([, source]) => source.includes('age.organization_id'));

    // 🛑 One `set_config` line. Two is how the two drift, and the copy that gets
    // relaxed still passes its own tests.
    expect(setters.map(([file]) => basename(file))).toEqual(['directory-scope-runner.ts']);
  });

  it('sets `age.platform_sign_in_email` in exactly one file', () => {
    // 🛑 ADR-0080 Option A's fence is ONE `set_config`, in the ONE runner that
    // opens the platform transaction. A second writer of this setting is a
    // second fence, and ⚠️ two fences are two chances to leave a gate open.
    const setters = sources.filter(([, source]) => source.includes('age.platform_sign_in_email'));

    expect(setters.map(([file]) => basename(file))).toEqual(['platform-directory-read.ts']);
  });

  it('🛑 keeps the two runners unconfusable — neither sets the other one’s setting', () => {
    // ⚠️ THE RULE IS MUTUAL, AND A ONE-DIRECTION SCAN CANNOT SEE HALF OF IT. A
    // tenant runner that also set the platform setting would carry the platform
    // fence into every tenant request; a platform runner that also set
    // `age.organization_id` would hand the platform reader one tenant's rows.
    for (const [file, source] of sources) {
      const base = basename(file);
      if (base === 'directory-scope-runner.ts') {
        expect(`${file}: ${source.includes('age.platform_sign_in_email')}`).toBe(`${file}: false`);
      }
      if (base === 'platform-directory-read.ts') {
        expect(`${file}: ${source.includes('age.organization_id')}`).toBe(`${file}: false`);
      }
    }
  });

  it('🚫 offers no way to run unscoped', () => {
    for (const [file, source] of sources) {
      expect(`${file}: ${source.includes('organizationId?')}`).toBe(`${file}: false`);
      expect(`${file}: ${/organizationId\s*[|&]{2}/.test(source)}`).toBe(`${file}: false`);
    }
  });
});

describe('🚫 it decides nothing about admission', () => {
  it.each(['admitted', 'refused', 'decideSignIn'])(
    '🚫 never mentions `%s` — that answer is `@age/sign-in-directory`.s, always',
    (token) => {
      for (const [file, source] of sources) {
        expect(`${file}: ${source.includes(token)}`).toBe(`${file}: false`);
      }
    },
  );

  it('🚫 and never branches on a scope kind', () => {
    for (const [file, source] of sources) {
      expect(`${file}: ${source.includes("'agency'")}`).toBe(`${file}: false`);
      expect(`${file}: ${source.includes("'platform'")}`).toBe(`${file}: false`);
      expect(`${file}: ${source.includes("'client'")}`).toBe(`${file}: false`);
    }
  });
});

/**
 * 🛑 **THE READ IS REACHABLE ONLY FROM A COMPOSITION DOOR, AND THE DOORS ARE
 * NAMED.**
 *
 * ⚠️ Slice 4 added the SECOND door, and it was added rather than folded into
 * the first on purpose: the sign-in door can INSERT a session, and a read that
 * happens on EVERY request must 🚫 not travel through a door that can mint a
 * credential. Two doors, each with one checkable sentence, beats one door whose
 * sentence needs an "except".
 *
 * 🛑 **A THIRD IMPORTER FAILS THIS.** A screen, a route or a server module
 * reaching past the doors straight into this package is how the directory turns
 * into a browsable one - which is exactly what the scoped delegates exist to
 * prevent.
 */
const REPO_ROOT = join(SRC, '..', '..', '..');
const ROOTS = ['packages', 'apps'].map((dir) => join(REPO_ROOT, dir));
const COMPOSITION_DOORS = [
  join(REPO_ROOT, 'apps', 'capture', 'src', 'deployed-scope-composition.ts'),
  join(REPO_ROOT, 'apps', 'capture', 'src', 'deployed-sign-in-composition.ts'),
];

/**
 * ⚠️ **`.tsx` IS INCLUDED HERE AND 🚫 NOT ABOVE, DELIBERATELY.** The
 * package-local walk reads `.ts` because this package has no components; the
 * product-wide walk must read `.tsx` too, or a SCREEN importing the directory
 * would be exactly the violation the guard cannot see.
 */
function productSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return productSourceFiles(full);
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
  });
}

describe('🛑 this package is reachable only from the composition doors', () => {
  const PRODUCT_FILES = ROOTS.flatMap((root) => productSourceFiles(root));

  it('walked the product, so an empty scan can never report compliance', () => {
    expect(PRODUCT_FILES.length).toBeGreaterThan(200);
    expect(PRODUCT_FILES.some((file) => file.endsWith('.tsx'))).toBe(true);
  });

  it('is imported by those two files and nothing else', () => {
    const PACKAGE_ROOT = join(SRC, '..');
    const importers = PRODUCT_FILES.filter(
      (file) =>
        !file.startsWith(PACKAGE_ROOT) &&
        readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .includes("from '@age/sign-in-directory-persistence'"),
    );

    expect(importers.sort()).toEqual([...COMPOSITION_DOORS].sort());
  });
});
