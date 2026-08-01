import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Repo-wide source guard for the standing rule "snapshots are immutable
 * append-only: no `update`, no `delete`, no `upsert`, anywhere".
 *
 * WHAT ALREADY ENFORCED IT, AND WHERE THE HOLE WAS.
 *
 *  - `ScoredBifSnapshotDelegate` omits every mutating method, so nothing can
 *    mutate a snapshot *through the adapter*. That is a type-level guarantee
 *    and it is strong.
 *  - The migration grants `SELECT, INSERT` only, and RLS `FORCE`s. That stops
 *    the `age_app` role at the database.
 *  - `scored-bif-snapshot-rls.db.spec.ts` proves both, live.
 *
 * The hole is between them. A new package holding a real `PrismaClient` can
 * call `prisma.scoredBifSnapshot.update(...)` directly: it never touches the
 * narrow adapter, so the type system permits it, and `ci-db.yml` is path-gated
 * to `packages/persistence/**`, `packages/scored-bif-snapshot-persistence/**`
 * and `apps/capture/**`, so a call written anywhere else never reaches the live
 * privilege tests either. Such a change merges green and fails in production —
 * against a database whose owner-role grants may have drifted.
 *
 * The blast radius is why this is worth a guard rather than a comment: the
 * table is append-only by design, so a bad or destructive write "cannot be
 * corrected or removed through the application at all".
 *
 * SCOPED ON PURPOSE. This scans for the mutating call only on a receiver whose
 * name mentions a snapshot, a delegate or Prisma. A blanket ban on `.delete(`
 * would fire on every `Map.delete` and `Set.delete` in the repo — and a guard
 * that cries wolf is a guard that gets deleted.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const SCAN_ROOTS = ['packages', 'apps'];

/**
 * A mutating Prisma call on a snapshot-ish receiver. `createMany` is absent
 * deliberately — it inserts, and inserting is the one write this table allows.
 */
const MUTATION =
  /(snapshot|delegate|prisma)[a-z0-9_]*\s*\.\s*(update|upsert|delete|updateMany|deleteMany)\s*\(/i;

/**
 * The repo has ~1,099 `.ts` files under `packages/` and `apps/` today. The
 * bound is far below that so ordinary growth or removal never fails this test,
 * while a walk that silently stopped finding files does.
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

describe('scored BIF snapshots are append-only in source, repo-wide', () => {
  it('finds the repository before asserting anything about it', () => {
    // Asserted first and separately: an empty walk must never be reportable as
    // compliance.
    expect(allSourceFiles().length).toBeGreaterThan(MINIMUM_FILES_SCANNED);
  });

  it('calls no mutating Prisma method on a snapshot delegate anywhere', () => {
    const offenders: string[] = [];
    let filesScanned = 0;

    for (const file of allSourceFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const line of source.split('\n')) {
        if (MUTATION.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
      filesScanned += 1;
    }

    expect(offenders).toEqual([]);
    // After the loop: the per-file line counts are not uniform, so the total is
    // the only honest place to assert the scan actually ran.
    expect(filesScanned).toBeGreaterThan(MINIMUM_FILES_SCANNED);
  });

  it('keeps the delegate interface to exactly the three non-mutating methods', () => {
    const declaration = stripComments(
      readFileSync(join(HERE, '..', 'scored-bif-snapshot-delegate.ts'), 'utf8'),
    );
    // Bounded at the interface's own closing brace. Slicing to end-of-file
    // instead would sweep up `isUniqueConstraintViolation`'s body below it.
    const start = declaration.indexOf('interface ScoredBifSnapshotDelegate');
    const body = declaration.slice(start, declaration.indexOf('\n}', start));
    const methods = [...body.matchAll(/^\s{2}([a-zA-Z]+)\s*\(/gm)].map((match) => match[1]);

    // Widening this interface IS the mutation, and would need its own ADR.
    expect(new Set(methods)).toEqual(new Set(['create', 'findUnique', 'findMany']));
  });

  it('detects the thing it bans — the pattern is not vacuous', () => {
    /**
     * Assembled rather than written out, so this file stays INSIDE the scan
     * above instead of being excluded from it. A literal
     * `prisma.scoredBifSnapshot.update(` here would make the guard flag its own
     * fixtures, and the obvious fix — skipping this file — would carve out the
     * one file a violation could then hide in.
     */
    const call = (receiver: string, method: string): string => `await ${receiver}.${method}({});`;

    expect(MUTATION.test(call('prisma.scoredBifSnapshot', 'update'))).toBe(true);
    expect(MUTATION.test(call('snapshotDelegate', 'deleteMany'))).toBe(true);
    expect(MUTATION.test(call('this.delegate', 'upsert'))).toBe(true);

    // …and does not fire on the ordinary collection calls a blanket ban would,
    // nor on the one write this table does allow.
    expect(MUTATION.test(call('seenIds', 'delete'))).toBe(false);
    expect(MUTATION.test(call('cache', 'update'))).toBe(false);
    expect(MUTATION.test(call('prisma.scoredBifSnapshot', 'create'))).toBe(false);
  });
});
