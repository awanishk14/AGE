import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Repo-wide source guard for **"AGE MINTS NOTHING. VERIFICATION IS NOT
 * ISSUANCE."** — ADR-0074 §7 slice 2, ADR-0061 A2.
 *
 * 🛑 **THIS CLOSES A MEASURED GAP.** `guards.spec.ts` next door already refuses
 * `create`, `upsert` and `delete` and pins `update` to the one revocation
 * module — but its walk starts at `join(__dirname, '..')`, so it asserts all of
 * that **about this package alone**. A module in `packages/client-registry`
 * calling `prisma.operatorSession.create(...)` — minting a session AGE never
 * verified — and then `.update(...)` to re-tenant and extend it passed **the
 * whole repository**: 59 projects' tests, `typecheck` and `lint`. ⚠️ Measured,
 * by writing exactly that module and running exactly those three commands.
 *
 * ⚠️ **THE DATABASE WOULD HAVE REFUSED IT, AND THAT IS NOT THE POINT.**
 * `operator_sessions` carries no `INSERT` grant at all, and its `UPDATE` grant
 * is column-scoped to `revoked_at` with a separate `FOR UPDATE` policy. So the
 * probe above merges **green** and dies on the **first real run against the
 * box** — the failure mode this repository has already been bitten by three
 * times, and the reason the sibling append-only guard scans the repository
 * rather than its own package.
 *
 * 🚫 **A NARROW SCAN IS NOT A NARROW RULE.** "AGE mints nothing" is a property
 * of the product, not of one package, so it is asserted over the product.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const SCAN_ROOTS = ['packages', 'apps'];

/**
 * 🛑 **THE ONE PERMITTED WRITE, AND IT IS A FILE, NOT A TOKEN** — ADR-0074 D3:
 * *"a logout that only clears the cookie is not a logout"*. AGE can END a
 * session it never issued; 🚫 it still cannot ISSUE one.
 */
const REVOCATION_MODULE = join(
  REPO_ROOT,
  'packages',
  'session-store-persistence',
  'src',
  'operator-session-revocation.ts',
);

/**
 * A write on a session-ish receiver. `find*` is absent deliberately — reading a
 * session is the whole point of a verified-session boundary.
 */
const SESSION_WRITE =
  /session[a-z0-9_]*\s*\.\s*(create|createMany|upsert|update|updateMany|delete|deleteMany)\s*\(/i;

/**
 * The repo has ~1,100 `.ts` files under `packages/` and `apps/` today. The bound
 * is far below that so ordinary growth never fails this test, while a walk that
 * silently stopped finding files does.
 */
const MINIMUM_FILES_SCANNED = 900;

/** Strip comments, so a file explaining the rule cannot violate it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (entry === 'node_modules' || entry === 'dist') return [];
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

function allSourceFiles(): string[] {
  return SCAN_ROOTS.flatMap((root) => sourceFiles(join(REPO_ROOT, root)));
}

describe('🛑 AGE mints no session, anywhere in the product', () => {
  it('finds the repository before asserting anything about it', () => {
    // Asserted first and separately: an empty walk must never be reportable as
    // compliance.
    expect(allSourceFiles().length).toBeGreaterThan(MINIMUM_FILES_SCANNED);
  });

  it('writes a session ONLY in the revocation module, repo-wide', () => {
    const offenders: string[] = [];
    let filesScanned = 0;
    let permittedWrites = 0;

    for (const file of allSourceFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const line of source.split('\n')) {
        if (!SESSION_WRITE.test(line)) continue;
        if (file === REVOCATION_MODULE) {
          permittedWrites += 1;
          continue;
        }
        offenders.push(`${file}: ${line.trim()}`);
      }
      filesScanned += 1;
    }

    expect(offenders).toEqual([]);
    expect(filesScanned).toBeGreaterThan(MINIMUM_FILES_SCANNED);
    // ⚠️ Asserted POSITIVELY too: an exemption whose file stopped containing the
    // thing it was exempted for is an exemption nobody would notice had become
    // a hole.
    expect(permittedWrites).toBe(1);
  });

  it('🚫 keeps even the exempt module to revocation — it may not create or delete', () => {
    const source = stripComments(readFileSync(REVOCATION_MODULE, 'utf8'));

    for (const method of ['create', 'createMany', 'upsert', 'delete', 'deleteMany']) {
      expect(source, REVOCATION_MODULE).not.toContain(method);
    }
  });

  it('detects the thing it bans — the pattern is not vacuous', () => {
    /**
     * Assembled rather than written out, so this file stays INSIDE the scan
     * above instead of being excluded from it. A literal
     * `prisma.operatorSession.create(` here would make the guard flag its own
     * fixtures, and the obvious fix — skipping this file — would carve out the
     * one file a violation could then hide in.
     */
    const call = (receiver: string, method: string): string => `await ${receiver}.${method}({});`;

    // 🛑 The exact shapes the measured probe used.
    expect(SESSION_WRITE.test(call('prisma.operatorSession', 'create'))).toBe(true);
    expect(SESSION_WRITE.test(call('prisma.operatorSession', 'update'))).toBe(true);
    expect(SESSION_WRITE.test(call('sessions', 'deleteMany'))).toBe(true);
    expect(SESSION_WRITE.test(call('this.sessionDelegate', 'upsert'))).toBe(true);

    // …and 🚫 does not fire on reading a session, which is the whole point of a
    // verified-session boundary.
    expect(SESSION_WRITE.test(call('prisma.operatorSession', 'findUnique'))).toBe(false);
    expect(SESSION_WRITE.test(call('sessions', 'findMany'))).toBe(false);
  });
});
