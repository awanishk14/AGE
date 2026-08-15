import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The three guards ADR-0058 D8 item 1 needs to stay true over time.
 *
 * ⚠️ Guard-test pattern (repo conventions): the walk must FIRST assert it found
 * files, so an empty scan can never report compliance; comments are stripped
 * before scanning for a banned token, or this module's own explanation of a rule
 * matches it; and excluded directories are pruned DURING the recursion, not
 * filtered afterwards — filtering afterwards `stat`s files other vitest
 * processes are concurrently deleting, which is the ENOENT that failed CI twice
 * on docs-only changes (fixed in #244).
 */

const SRC = join(__dirname, '..');
const REPO_ROOT = join(SRC, '..', '..', '..');

const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
  });
}

function packageManifests(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) return [];
    const manifest = join(full, 'package.json');
    return [...(existsSync(manifest) ? [manifest] : []), ...packageManifests(full)];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const ROOTS = ['packages', 'apps'].map((dir) => join(REPO_ROOT, dir)).filter(existsSync);
const REPO_FILES = ROOTS.flatMap((root) => sourceFiles(root));

describe('@age/entitlement is pure', () => {
  const files = sourceFiles(SRC).filter((file) => !file.endsWith('.spec.ts'));

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

  it('declares no dependencies at all', () => {
    const declared = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(declared.dependencies)).toEqual([]);
  });
});

/**
 * 🛑 ADR-0058 D2: there is EXACTLY ONE implementation of the entitlement
 * question. Two copies of one fail-closed rule drift silently, and the relaxed
 * copy still passes its own tests.
 */
describe('the entitlement question exists in exactly one place', () => {
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

  it('has one and only one implementation', () => {
    // ⚠️ Specs are excluded HERE and only here: a test that pins the words is
    // not a second implementation of the rule. 🚫 They stay in the no-caller
    // scan below, where a spec importing this package WOULD be a caller.
    const implementers = REPO_FILES.filter(
      (file) => !file.endsWith('.spec.ts') && !file.endsWith('.test.ts'),
    ).filter((file) =>
      stripComments(readFileSync(file, 'utf8')).includes('no authenticated identity exists'),
    );

    expect(implementers).toHaveLength(1);
    expect(implementers[0]).toBe(join(SRC, 'entitlement-question.ts'));
  });

  it('carries none of the bypasses ADR-0058 D2 refuses by name', () => {
    // ⚠️ WIDENED IN THE ADR-0061 A3 SLICE from one file to every source file in
    // the package. A second module now exists, and a bypass added to the newer
    // one would have passed a guard that only ever read the older one.
    const scanned = sourceFiles(SRC).filter((file) => !file.endsWith('.spec.ts'));

    expect(scanned.length).toBeGreaterThanOrEqual(3);

    for (const file of scanned) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const bypass of [
        'allowAll',
        'SYSTEM_PRINCIPAL',
        'entitlementOrDefault',
        'devMode',
        'bypass',
        'OperatorPrincipal',
        'isAdmin',
        'role',
      ]) {
        expect(source, `${file} must not contain ${bypass}`).not.toContain(bypass);
      }
    }
  });

  it('enumerates every arm and adds no default (ADR-0061 A3)', () => {
    // 🛑 A `default` arm silences the compile error that adding an
    // authentication kind is SUPPOSED to cause. A3 refuses it by name, so the
    // absence is asserted rather than assumed.
    const source = stripComments(readFileSync(join(SRC, 'entitlement-question.ts'), 'utf8'));

    expect(source).not.toMatch(/\bdefault\s*:/);
    expect(source).toContain("case 'verified-session':");
    expect(source).toContain("case 'none':");
  });

  it('issues, stores and verifies no session (ADR-0061 A2)', () => {
    // 🚫 A session store is entirely effects, and this package performs none.
    // The purity scan above already bans the I/O; these ban the VOCABULARY, so
    // that a store cannot begin as "just the pure part" of one.
    for (const file of sourceFiles(SRC).filter((file) => !file.endsWith('.spec.ts'))) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const token of ['argon2', 'bcrypt', 'password', 'cookie', 'token', 'issueSession']) {
        expect(source.toLowerCase(), `${file} must not contain ${token}`).not.toContain(
          token.toLowerCase(),
        );
      }
    }
  });
});

/**
 * 🛑 ADR-0058 D8: acceptance authorizes the question "with no caller".
 *
 * ⚠️ **DELIBERATELY NARROWED IN THE ADR-0061 A4 SLICE, AND 🚫 NOT DELETED.** A4
 * derives the deployed workspace root "from the authenticated organization",
 * which requires `@age/tenant-workspace` to import the SESSION TYPE. That import
 * is authorized by A4 in those words. What A4 does 🚫 **not** authorize is a
 * caller of the DECISION — no middleware, no route guard, no read path — so the
 * guard now pins `askEntitlement` itself, which is the thing ADR-0058 D8 and
 * 🛑 the still-undischarged ADR-0055 D7 actually care about.
 *
 * ⚠️ The package-import scan is kept and narrowed to an ALLOW-LIST of one, so a
 * second importer is still a failure rather than a silently widened rule.
 */
describe('askEntitlement has exactly one caller', () => {
  const OUTSIDE = REPO_FILES.filter((file) => !file.startsWith(join(SRC, '..')));

  // ⚠️ WIDENED BY ONE IN THE A2 SESSION-STORE SLICE, AND 🚫 STILL AN ALLOW-LIST.
  // `@age/session-store` turns a stored row into a `VerifiedSession` — A2's own
  // words — which is again the SESSION TYPE, never the decision. Its own guard
  // asserts it contains no `askEntitlement`.
  // ⚠️ WIDENED BY ONE AGAIN IN THE A6 ITEM 5 SLICE, AND 🚫 STILL AN ALLOW-LIST.
  // `@age/tenant-isolation` compares a requested organization against the one
  // the session speaks for, so it needs `AuthenticatedOrganizationId` — the
  // SESSION TYPE, 🚫 never the decision. Its own guard asserts it contains no
  // `askEntitlement`, and the load-bearing test below is unchanged: the CALL
  // still has no caller anywhere in the repository.
  // ⚠️ WIDENED BY ONE AGAIN IN THE A6 ITEM 6 SLICE, AND 🚫 STILL AN ALLOW-LIST.
  // `@age/audit-trail` scopes an audit QUESTION to the organization the session
  // speaks for — an audit read is a read — so it needs the same session type.
  // 🚫 Never the decision: its own guard asserts it contains no `askEntitlement`.
  // 🛑 WIDENED BY ONE AGAIN IN SLICE 7, AND THIS TIME FOR THE DECISION ITSELF —
  // ADR-0068 §0.1b, which lowers exactly three things and names this as one:
  // *`askEntitlement`'s first real caller, on a READ path*. `@age/entitled-read`
  // is that caller. 🚫 The allow-list is still an allow-list: a second caller is
  // a failure, and the test below pins the count at one rather than deleting the
  // rule that used to pin it at zero.
  const AUTHORIZED_IMPORTERS = [
    'tenant-workspace',
    'session-store',
    'tenant-isolation',
    'audit-trail',
    'entitled-read',
  ];

  /** ⚠️ The ONE authorized caller, by path. 🚫 Not a prefix, not a glob. */
  const THE_CALLER = join('packages', 'entitled-read', 'src', 'entitled-organization-read.ts');

  it('found files outside this package to scan', () => {
    expect(OUTSIDE.length).toBeGreaterThan(50);
    expect(OUTSIDE.length).toBeLessThan(REPO_FILES.length);
  });

  it('the decision has exactly ONE caller, and it is the one ADR-0068 authorizes', () => {
    // 🛑 THE LOAD-BEARING ONE, AND ⚠️ **DELIBERATELY CHANGED IN SLICE 7, 🚫 NOT
    // DELETED.** It used to assert zero callers, citing ADR-0058 D8 and the
    // undischarged ADR-0055 D7. ADR-0068 §0.1b authorized the first real caller
    // on a READ path by name, so the rule becomes ONE — which is still a rule a
    // second caller breaks. 🚫 What is still not authorized: a middleware, a
    // route guard, a write path, or any second copy of the decision.
    // ⚠️ The scan is for the CALL — `askEntitlement(` — not for the bare name.
    let examined = 0;
    const callers: string[] = [];
    for (const file of OUTSIDE) {
      examined += 1;
      if (stripComments(readFileSync(file, 'utf8')).includes('askEntitlement(')) {
        callers.push(file);
      }
    }
    expect(examined).toBe(OUTSIDE.length);

    // ⚠️ Every mention lives in the authorized package — including its own
    // guard, which names the call in order to pin where it happens.
    for (const caller of callers) {
      expect(caller.includes(join('packages', 'entitled-read')), caller).toBe(true);
    }

    // 🛑 And exactly ONE of them is shipped source. A second is the failure.
    const shipped = callers.filter((file) => !file.endsWith('.spec.ts'));
    expect(shipped).toHaveLength(1);
    expect(shipped[0]?.endsWith(THE_CALLER)).toBe(true);
  });

  /**
   * ⚠️ **THE SCAN IS FOR THE IMPORT, 🚫 NOT FOR THE BARE NAME** — narrowed in
   * ADR-0074 §7 slice 2, and 🚫 the rule itself is unchanged.
   *
   * It used to match any file mentioning `@age/entitlement` anywhere, which
   * reported `apps/mcp/src/tests/trust-boundary.spec.ts` — a guard whose whole
   * purpose is to assert that `apps/mcp` never gains this dependency, and which
   * must therefore name it in code rather than in a comment. A test that fails
   * because another test forbids the same thing is measuring the wrong noun.
   *
   * 🛑 **THE NARROWING IS PRECISE AND DELIBERATE**: an *importer* is a file with
   * an import statement, so that is what is matched — the same reasoning as the
   * caller test above, which scans for `askEntitlement(` and not for the bare
   * name. 🚫 It is NOT an exemption for spec files, and 🚫 not a path allowance:
   * a spec that really imported the package would still be reported. The
   * manifest scan below is untouched, so a package that merely DECLARED the
   * dependency is still caught before anybody imports it.
   */
  it('is imported by exactly the packages ADR-0061 A2 and A4 authorize', () => {
    const importers = OUTSIDE.filter((file) =>
      /from\s*'@age\/entitlement'|require\(\s*'@age\/entitlement'\s*\)/.test(
        stripComments(readFileSync(file, 'utf8')),
      ),
    );

    for (const importer of importers) {
      expect(
        AUTHORIZED_IMPORTERS.some((pkg) => importer.includes(join('packages', pkg))),
        `${importer} imports @age/entitlement without an ADR authorizing it`,
      ).toBe(true);
    }
  });

  it('is depended on by no unauthorized package manifest', () => {
    const manifests = ROOTS.flatMap((root) => packageManifests(root));

    expect(manifests.length).toBeGreaterThan(10);
    for (const manifest of manifests) {
      if (manifest === join(SRC, '..', 'package.json')) continue;
      if (AUTHORIZED_IMPORTERS.some((pkg) => manifest.includes(join('packages', pkg)))) continue;
      expect(readFileSync(manifest, 'utf8')).not.toContain('@age/entitlement');
    }
  });
});
