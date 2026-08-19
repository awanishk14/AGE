import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Product-wide source guard for **"A SESSION IS WRITTEN IN EXACTLY TWO NAMED
 * MODULES, AND NOWHERE ELSE"** — ADR-0079 §3 and §6 slice 2, ADR-0074 §7
 * slice 2, ADR-0061 A2.
 *
 * 🛑 **WHAT ADR-0079 CHANGED HERE, AND ONLY THIS.** This guard used to assert
 * *"AGE mints nothing"* — one exempt module, the revocation one, and every
 * `create` in the product an offence. ADR-0079 §3 overturned that refusal, as a
 * decision request answered by the Product Owner verbatim in its §0.2: *"AGE
 * **may issue a session** after verifying an external identity."* So the rule
 * is no longer "no session is ever written"; it is **"a session is written in
 * exactly two named modules"** — one that STARTS a session and one that ENDS
 * one — and each is still pinned to the single verb it holds a grant for.
 *
 * 🚫 **THE GUARD WAS NARROWED TO FOLLOW THE CHANGE, 🚫 NOT WIDENED TO ADMIT
 * IT.** `createMany`, `upsert`, `delete` and `deleteMany` are refused
 * EVERYWHERE including both exempt modules; `create` is refused everywhere
 * except the issuance module; `update`/`updateMany` everywhere except the
 * revocation module. ⚠️ The database says the same thing in grants: `INSERT`,
 * `SELECT`, and `UPDATE ("revoked_at")` — 🚫 no DELETE at all.
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
 * 🚫 **A NARROW SCAN IS NOT A NARROW RULE.** "A session is written in exactly
 * two named modules" is a property of the PRODUCT, not of one package, so it is
 * asserted over `packages` and `apps` together.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const SCAN_ROOTS = ['packages', 'apps'];

/**
 * 🛑 **THE PERMITTED WRITES ARE FILES PAIRED WITH VERBS, 🚫 NOT FILES ALONE.**
 * An exemption that said only "this file may write a session" would let the
 * revocation module grow a `create` — the issuance path arriving in the one
 * file nobody re-reads. Each module is pinned to the verb it holds a database
 * GRANT for, and 🚫 to nothing else.
 *
 * ⚠️ **ENDING A SESSION IS NOT STARTING ONE, AND THE TWO LIVE IN DIFFERENT
 * PACKAGES.** ADR-0074 D3 — *"a logout that only clears the cookie is not a
 * logout"* — bought the revocation module a column-scoped `UPDATE`. ADR-0079 §3
 * bought the issuance module an `INSERT`. 🚫 Neither borrows the other's verb,
 * and 🚫 neither holds a `DELETE`, because the database grants none.
 */
const REVOCATION_MODULE = join(
  REPO_ROOT,
  'packages',
  'session-store-persistence',
  'src',
  'operator-session-revocation.ts',
);

const ISSUANCE_MODULE = join(
  REPO_ROOT,
  'packages',
  'session-issuance-persistence',
  'src',
  'operator-session-issuance.ts',
);

/**
 * ⚠️ The verbs are compared CASE-FOLDED, because the scanning regex is
 * case-insensitive: a set holding `updateMany` verbatim would never match the
 * folded verb, and the exemption would silently become a ban.
 */
const PERMITTED_WRITES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  [REVOCATION_MODULE, new Set(['update', 'updateMany'].map((verb) => verb.toLowerCase()))],
  [ISSUANCE_MODULE, new Set(['create'].map((verb) => verb.toLowerCase()))],
]);

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

describe('🛑 a session is written in exactly two named modules, product-wide', () => {
  it('finds the repository before asserting anything about it', () => {
    // Asserted first and separately: an empty walk must never be reportable as
    // compliance.
    expect(allSourceFiles().length).toBeGreaterThan(MINIMUM_FILES_SCANNED);
  });

  it('writes a session ONLY in the two exempt modules, and only with their own verb', () => {
    const offenders: string[] = [];
    let filesScanned = 0;
    const permittedWrites = new Map<string, number>();

    for (const file of allSourceFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const line of source.split('\n')) {
        const match = SESSION_WRITE.exec(line);
        if (match === null) continue;
        const verb = (match[1] ?? '').toLowerCase();
        // 🛑 The VERB is checked as well as the file. An exempt module that grew
        // the OTHER module's verb would otherwise pass here unseen — and
        // "this file may write a session" is exactly how the revocation module
        // would come to hold an issuance path.
        if (PERMITTED_WRITES.get(file)?.has(verb) === true) {
          permittedWrites.set(file, (permittedWrites.get(file) ?? 0) + 1);
          continue;
        }
        offenders.push(`${file}: ${line.trim()}`);
      }
      filesScanned += 1;
    }

    expect(offenders).toEqual([]);
    expect(filesScanned).toBeGreaterThan(MINIMUM_FILES_SCANNED);
    // ⚠️ Asserted POSITIVELY too, and PER EXEMPTION: an exemption whose file
    // stopped containing the thing it was exempted for is an exemption nobody
    // would notice had become a hole.
    // ⚠️ **TWO SINCE ADR-0083 D5, AND THE NUMBER IS EXACT.** Each module now
    // holds the SAME verb twice — once under a tenant scope, once under the
    // digest fence a platform session runs in. 🚫 That is a second SCOPE, not a
    // second place a session is written, and the count is pinned rather than
    // relaxed to `toBeGreaterThan` so a THIRD call still fails here.
    expect(permittedWrites.get(REVOCATION_MODULE)).toBe(2);
    expect(permittedWrites.get(ISSUANCE_MODULE)).toBe(2);
  });

  it('🚫 keeps the revocation module to revocation — it may not create or delete', () => {
    const source = stripComments(readFileSync(REVOCATION_MODULE, 'utf8'));

    for (const method of ['create', 'createMany', 'upsert', 'delete', 'deleteMany']) {
      expect(source, REVOCATION_MODULE).not.toContain(method);
    }
  });

  it('🚫 keeps the issuance module to issuance — it may not update or delete', () => {
    // 🛑 The INSERT is what ADR-0079 §3 authorized, and nothing beside it.
    // Extending a session, repointing one, re-tenanting one and erasing one are
    // none of them issuance — and the database holds no DELETE grant at all.
    const source = stripComments(readFileSync(ISSUANCE_MODULE, 'utf8'));

    for (const method of ['createMany', 'upsert', 'update', 'delete', 'deleteMany']) {
      expect(source, ISSUANCE_MODULE).not.toContain(method);
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
