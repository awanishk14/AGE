import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { OperatorSessionDelegate } from '../operator-session-delegate';
import { platformOperatorSessionLookup } from '../operator-session-lookup';
import {
  platformOperatorSessionRevocation,
  type OperatorSessionRevocationDelegate,
} from '../operator-session-revocation';
import {
  PrismaOperatorSessionScopeRunner,
  type OperatorSessionScopeRunner,
  type OperatorSessionTransactionSource,
} from '../operator-session-scope-runner';

/**
 * ADR-0083 **D5** — the scope a session with 🚫 no organization runs under.
 *
 * 🛑 **WHAT THESE PROVE.** That a platform transaction sets the DIGEST fence and
 * 🚫 never `age.organization_id`; that a tenant transaction is byte-identical to
 * what it was (D2); that the fence a caller opens with is the same digest it
 * then matches on, so 🚫 no caller can name a scope it is not already inside;
 * and that each setting is named in exactly ONE place, product-wide.
 *
 * ⚠️ **THE PRODUCT-WIDE SCAN IS THE POINT OF THE LAST DESCRIBE.** A second
 * `set_config('age.organization_id', …)` in another package would be invisible
 * to a scan of this one — **A NARROW SCAN IS NOT A NARROW RULE**.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const SRC = join(__dirname, '..');
const REPO_ROOT = join(SRC, '..', '..', '..');
const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist', '.nx', '.next']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    // ⚠️ Pruned DURING the recursion, never filtered afterwards — filtering
    // afterwards `stat`s files other vitest processes are deleting.
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
  });
}

const ROOTS = ['packages', 'apps'].map((dir) => join(REPO_ROOT, dir)).filter(existsSync);
const REPO_FILES = ROOTS.flatMap((root) => sourceFiles(root));

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const repoRelative = (file: string): string =>
  file
    .slice(REPO_ROOT.length + 1)
    .split('\\')
    .join('/');

const DIGEST = 'a'.repeat(64);
const OTHER_DIGEST = 'b'.repeat(64);
const ORG = 'org-fictional-1';

/** What a transaction actually executed: the SQL, and the values bound into it. */
interface Executed {
  readonly sql: string;
  readonly values: readonly unknown[];
}

function recordingSource<TDelegate>(
  delegate: TDelegate,
  executed: Executed[],
): OperatorSessionTransactionSource<TDelegate> {
  return {
    async $transaction<T>(operation: (tx: never) => Promise<T>): Promise<T> {
      const tx = {
        // ⚠️ `query.join('?')` keeps the interpolation VISIBLE as a hole. A
        // value spliced into the SQL text would show up inside `sql`, and a
        // bound one shows up in `values` — the tests below tell them apart.
        async $executeRaw(query: TemplateStringsArray, ...values: unknown[]) {
          executed.push({ sql: query.join('?'), values });
          return 1;
        },
        operatorSession: delegate,
      };

      return operation(tx as never);
    },
  };
}

describe('🛑 a platform transaction sets the DIGEST fence and 🚫 never an organization', () => {
  const delegate: OperatorSessionDelegate = { findUnique: async () => null };

  it('sets `age.platform_session_token_hash`, and that setting ONLY', async () => {
    const executed: Executed[] = [];
    const runner = new PrismaOperatorSessionScopeRunner(recordingSource(delegate, executed));

    await runner.runInScope({ platformSessionTokenHash: DIGEST }, async () => 'done');

    // 🛑 EXACTLY ONE STATEMENT. A transaction that ALSO set `age.organization_id`
    // would satisfy the tenant policies as well, and the fence would stop being
    // a fence — so the count is asserted, 🚫 not just the content.
    expect(executed).toHaveLength(1);
    expect(executed[0]?.sql).toContain('age.platform_session_token_hash');
    expect(executed[0]?.sql).not.toContain('age.organization_id');
  });

  it('binds the digest as a PARAMETER — 🚫 never spliced into the SQL text', async () => {
    const executed: Executed[] = [];
    const runner = new PrismaOperatorSessionScopeRunner(recordingSource(delegate, executed));

    await runner.runInScope({ platformSessionTokenHash: DIGEST }, async () => 'done');

    expect(executed[0]?.values).toEqual([DIGEST]);
    // ⚠️ The digest is a credential's digest. Spliced into SQL it would also be
    // spliced into every query log and slow-query trace.
    expect(executed[0]?.sql).not.toContain(DIGEST);
  });

  it('🚫 leaves the TENANT transaction byte-identical (ADR-0083 D2)', async () => {
    const executed: Executed[] = [];
    const runner = new PrismaOperatorSessionScopeRunner(recordingSource(delegate, executed));

    await runner.runInScope({ organizationId: ORG }, async () => 'done');

    expect(executed).toHaveLength(1);
    expect(executed[0]?.sql).toContain('age.organization_id');
    expect(executed[0]?.sql).not.toContain('age.platform_session_token_hash');
    expect(executed[0]?.values).toEqual([ORG]);
  });

  it('hands the operation a delegate bound to THAT transaction', async () => {
    const executed: Executed[] = [];
    const marked: OperatorSessionDelegate = { findUnique: async () => 'from-the-transaction' };
    const runner = new PrismaOperatorSessionScopeRunner(recordingSource(marked, executed));

    const seen = await runner.runInScope({ platformSessionTokenHash: DIGEST }, async (sessions) =>
      sessions.findUnique({ where: { tokenHash: DIGEST } }),
    );

    expect(seen).toBe('from-the-transaction');
  });
});

function fakeRunner<TDelegate>(
  delegate: TDelegate,
  log: string[],
): OperatorSessionScopeRunner<TDelegate> {
  return {
    async runInScope(scope, operation) {
      log.push(
        'platformSessionTokenHash' in scope
          ? `platform-scope:${scope.platformSessionTokenHash}`
          : `tenant-scope:${scope.organizationId}`,
      );
      return operation(delegate);
    },
  };
}

describe('platformOperatorSessionLookup', () => {
  it('🛑 fences on the SAME digest it then matches on, and in that order', async () => {
    const log: string[] = [];
    const delegate: OperatorSessionDelegate = {
      findUnique: async (args) => {
        log.push(`findUnique:${args.where.tokenHash}`);
        return null;
      },
    };

    await platformOperatorSessionLookup(fakeRunner(delegate, log))(DIGEST);

    // 🛑 THE ORDER IS THE ARGUMENT, and the EQUALITY of the two values is the
    // second one: a fence opened on some other digest would be a scope the
    // caller does not hold.
    expect(log).toEqual([`platform-scope:${DIGEST}`, `findUnique:${DIGEST}`]);
  });

  it('🚫 never opens a TENANT scope — not even an empty one', async () => {
    const log: string[] = [];
    const delegate: OperatorSessionDelegate = { findUnique: async () => null };

    await platformOperatorSessionLookup(fakeRunner(delegate, log))(DIGEST);

    // ⚠️ `age.organization_id` set to `''` would be the two-absences-agreeing
    // shape ADR-0083 refused in the entitlement core, spelled in SQL.
    expect(log.filter((entry) => entry.startsWith('tenant-scope:'))).toEqual([]);
  });

  it('⚠️ `null` travels as `null` — 🚫 not a refusal, an error or an empty object', async () => {
    const delegate: OperatorSessionDelegate = { findUnique: async () => null };

    await expect(
      platformOperatorSessionLookup(fakeRunner(delegate, []))(DIGEST),
    ).resolves.toBeNull();
  });

  it('⚠️ returns the row RAW, so `normalizeSessionRecord` re-validates it', async () => {
    const row = { sessionId: 'session-fictional-9', organizationId: null };
    const delegate: OperatorSessionDelegate = { findUnique: async () => row };

    await expect(platformOperatorSessionLookup(fakeRunner(delegate, []))(DIGEST)).resolves.toBe(
      row,
    );
  });
});

describe('platformOperatorSessionRevocation', () => {
  const revoked = '2026-08-19T12:00:00.000Z';

  it('🛑 opens the fence with the PRESENTED digest, then updates', async () => {
    const log: string[] = [];
    const delegate: OperatorSessionRevocationDelegate = {
      updateMany: async (args) => {
        log.push(`updateMany:${args.where.sessionId}`);
        return { count: 1 };
      },
    };

    const revoke = platformOperatorSessionRevocation(fakeRunner(delegate, log));
    await expect(revoke(DIGEST, 'session-fictional-9', revoked)).resolves.toBe('revoked');

    expect(log).toEqual([`platform-scope:${DIGEST}`, 'updateMany:session-fictional-9']);
  });

  it('⚠️ reports `already-ended` when nothing matched — 🚫 never an error', async () => {
    const delegate: OperatorSessionRevocationDelegate = {
      updateMany: async () => ({ count: 0 }),
    };

    const revoke = platformOperatorSessionRevocation(fakeRunner(delegate, []));

    // ⚠️ A logout pressed twice, or with a stale cookie, has left the operator
    // exactly where they wanted to be. 🚫 The two outcomes stay two.
    await expect(revoke(OTHER_DIGEST, 'session-fictional-9', revoked)).resolves.toBe(
      'already-ended',
    );
  });

  it('🚫 writes `revokedAt` and nothing else', async () => {
    const written: unknown[] = [];
    const delegate: OperatorSessionRevocationDelegate = {
      updateMany: async (args) => {
        written.push(args.data);
        return { count: 1 };
      },
    };

    await platformOperatorSessionRevocation(fakeRunner(delegate, []))(
      DIGEST,
      'session-fictional-9',
      revoked,
    );

    expect(written).toEqual([{ revokedAt: revoked }]);
  });
});

describe('🛑 each scope setting is named in EXACTLY ONE place, product-wide (D5)', () => {
  it('walked the repository rather than trusting one path', () => {
    // ⚠️ A floor, so a walk that silently found nothing fails here rather than
    // passing the scans below vacuously.
    expect(REPO_FILES.length).toBeGreaterThan(200);
  });

  const settersOf = (setting: string): string[] =>
    REPO_FILES.filter((file) => !file.endsWith('.spec.ts') && !file.endsWith('.test.ts'))
      .filter((file) =>
        stripComments(readFileSync(file, 'utf8')).includes(`set_config('${setting}'`),
      )
      .map(repoRelative)
      .sort();

  it('🛑 sets `age.platform_session_token_hash` from EXACTLY ONE module', () => {
    // 🛑 THE NEW SETTING IS THE FENCE ITSELF. A second module setting it would
    // be a second way to open a platform transaction, and D5's *never* would
    // hold only in the copy that was read.
    expect(settersOf('age.platform_session_token_hash')).toEqual([
      'packages/session-store-persistence/src/operator-session-scope-runner.ts',
    ]);
  });

  it('⚠️ pins the four modules that set `age.organization_id` — a FIFTH fails here', () => {
    // ⚠️ **THE HONEST RULE, 🚫 NOT THE CONVENIENT ONE.** `age.organization_id`
    // is the tenant fence for FOUR different tables, each with its own scope
    // runner, and asserting "one module" would be false today. What must not
    // happen is a new one appearing unnoticed — so the list is pinned whole.
    expect(settersOf('age.organization_id')).toEqual([
      'packages/scored-bif-snapshot-persistence/src/prisma-scored-bif-snapshot-scope-runner.ts',
      'packages/session-store-persistence/src/operator-session-scope-runner.ts',
      'packages/sign-in-directory-persistence/src/directory-scope-runner.ts',
      'packages/source-observation-persistence/src/source-observation-scope-runner.ts',
    ]);
  });

  it('🛑 no module sets BOTH settings except the one that branches between them', () => {
    const both = REPO_FILES.filter(
      (file) => !file.endsWith('.spec.ts') && !file.endsWith('.test.ts'),
    )
      .filter((file) => {
        const source = stripComments(readFileSync(file, 'utf8'));
        return (
          source.includes("set_config('age.organization_id'") &&
          source.includes("set_config('age.platform_session_token_hash'")
        );
      })
      .map(repoRelative);

    // ⚠️ One file may name both, because it is the file that chooses between
    // them — and the very next test asserts the choice is an `else`.
    expect(both).toEqual([
      'packages/session-store-persistence/src/operator-session-scope-runner.ts',
    ]);
  });

  it('🛑 the two settings are MUTUALLY EXCLUSIVE, by an `else` rather than by discipline', () => {
    const source = stripComments(
      readFileSync(join(SRC, 'operator-session-scope-runner.ts'), 'utf8'),
    );

    const platform = source.indexOf("set_config('age.platform_session_token_hash'");
    const otherwise = source.indexOf('} else {');
    const tenant = source.indexOf("set_config('age.organization_id'");

    // 🛑 IF THE `else` WERE DELETED, BOTH SETTINGS WOULD BE SET ON EVERY
    // PLATFORM TRANSACTION — and the behavioural tests above would still pass
    // for the tenant path, because setting the digest as well changes nothing
    // a tenant policy reads.
    expect(platform).toBeGreaterThan(-1);
    expect(otherwise).toBeGreaterThan(platform);
    expect(tenant).toBeGreaterThan(otherwise);
  });

  it('🚫 offers no way to conjure a scope the caller does not hold', () => {
    const source = stripComments(
      readFileSync(join(SRC, 'operator-session-scope-runner.ts'), 'utf8'),
    );

    // ⚠️ Each of these is one keystroke and reads as harmless; each would open a
    // transaction under a scope nobody presented.
    for (const banned of [
      'organizationId ??',
      'organizationId ||',
      "organizationId ?? ''",
      'platformSessionTokenHash ??',
      '$executeRawUnsafe',
    ]) {
      expect(`${banned}: ${source.includes(banned)}`).toBe(`${banned}: false`);
    }
  });
});
