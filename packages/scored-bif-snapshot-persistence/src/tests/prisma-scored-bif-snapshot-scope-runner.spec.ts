import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  PrismaScoredBifSnapshotScopeRunner,
  type ScoredBifSnapshotScopeTransaction,
  type ScoredBifSnapshotTransactionSource,
} from '../prisma-scored-bif-snapshot-scope-runner';
import type { ScoredBifSnapshotDelegate } from '../scored-bif-snapshot-delegate';
import { FakeScoredBifSnapshotDelegate } from './fake-scored-bif-snapshot-delegate';

/**
 * What these tests can and cannot prove.
 *
 * They prove the runner's own logic: that it opens exactly one transaction,
 * applies both settings before the operation runs, binds the scope ids as
 * parameters instead of splicing them into SQL, and hands the operation the
 * delegate belonging to that transaction. That is all logic, and a fake is the
 * right instrument for it.
 *
 * They do NOT prove the settings satisfy the RLS policy, that a real
 * `PrismaClient` satisfies the structural interfaces, or that an unscoped
 * transaction fails closed. Those need PostgreSQL and are asserted in
 * `packages/persistence/src/tests/scored-bif-snapshot-rls.db.spec.ts`, which
 * runs as the non-owner `age_app` role in `ci-db.yml`.
 */

interface RecordedStatement {
  readonly sql: readonly string[];
  readonly values: readonly unknown[];
}

/**
 * A transaction source that records what it was asked to do.
 *
 * `$executeRaw` captures the template's literal fragments separately from its
 * interpolated values, which is precisely the distinction the tests need: a
 * bound parameter appears in `values`, while a spliced one would appear inside
 * `sql`.
 */
class RecordingTransactionSource implements ScoredBifSnapshotTransactionSource {
  readonly transactions: number[] = [];
  readonly statements: RecordedStatement[] = [];
  readonly delegate = new FakeScoredBifSnapshotDelegate();

  /** Set by the transaction, read by a test asserting the operation saw THIS one. */
  private readonly tx: ScoredBifSnapshotScopeTransaction;

  constructor() {
    const statements = this.statements;
    const delegate = this.delegate;

    this.tx = {
      async $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown> {
        statements.push({ sql: [...query], values });
        return 1;
      },
      scoredBifSnapshot: delegate,
    };
  }

  async $transaction<T>(
    operation: (tx: ScoredBifSnapshotScopeTransaction) => Promise<T>,
  ): Promise<T> {
    this.transactions.push(this.transactions.length + 1);
    return operation(this.tx);
  }

  expectedDelegate(): ScoredBifSnapshotDelegate {
    return this.tx.scoredBifSnapshot;
  }
}

const SCOPE = { clientId: 'client-a', organizationId: 'org-alpha' } as const;

describe('PrismaScoredBifSnapshotScopeRunner', () => {
  it('runs the operation inside exactly one transaction', async () => {
    const source = new RecordingTransactionSource();
    const runner = new PrismaScoredBifSnapshotScopeRunner(source);

    await runner.runInScope(SCOPE, async () => 'done');

    expect(source.transactions).toHaveLength(1);
  });

  it('applies both scope settings, client first, before the operation runs', async () => {
    const source = new RecordingTransactionSource();
    const runner = new PrismaScoredBifSnapshotScopeRunner(source);

    let statementsWhenOperationRan = -1;
    await runner.runInScope(SCOPE, async () => {
      statementsWhenOperationRan = source.statements.length;
      return null;
    });

    expect(statementsWhenOperationRan).toBe(2);
    expect(source.statements).toHaveLength(2);
    expect(source.statements[0]?.sql.join('?')).toContain('age.client_id');
    expect(source.statements[1]?.sql.join('?')).toContain('age.organization_id');
  });

  it('makes both settings transaction-local', async () => {
    const source = new RecordingTransactionSource();
    const runner = new PrismaScoredBifSnapshotScopeRunner(source);

    await runner.runInScope(SCOPE, async () => null);

    // The third argument of set_config is `is_local`. `true` is what makes the
    // setting die with the transaction instead of leaking to the next borrower
    // of a pooled connection.
    for (const statement of source.statements) {
      expect(statement.sql.join('?')).toContain('true');
      expect(statement.sql.join('?')).toContain('set_config');
    }
  });

  it('binds the scope ids as parameters and never splices them into SQL', async () => {
    const source = new RecordingTransactionSource();
    const runner = new PrismaScoredBifSnapshotScopeRunner(source);

    await runner.runInScope(SCOPE, async () => null);

    expect(source.statements[0]?.values).toEqual(['client-a']);
    expect(source.statements[1]?.values).toEqual(['org-alpha']);

    // The literal fragments are the whole of the SQL text. Neither id may appear
    // in them, or the value reached the statement as text.
    const sqlText = source.statements.flatMap((statement) => statement.sql).join('');
    expect(sqlText).not.toContain('client-a');
    expect(sqlText).not.toContain('org-alpha');
  });

  it('survives a scope id that would be an injection if it were spliced', async () => {
    const source = new RecordingTransactionSource();
    const runner = new PrismaScoredBifSnapshotScopeRunner(source);

    const hostile = "x', false); DROP TABLE scored_bif_snapshots; --";
    await runner.runInScope({ clientId: hostile, organizationId: 'org-alpha' }, async () => null);

    expect(source.statements[0]?.values).toEqual([hostile]);
    expect(source.statements.flatMap((statement) => statement.sql).join('')).not.toContain('DROP');
  });

  it('hands the operation the delegate bound to that transaction', async () => {
    const source = new RecordingTransactionSource();
    const runner = new PrismaScoredBifSnapshotScopeRunner(source);

    let received: ScoredBifSnapshotDelegate | null = null;
    await runner.runInScope(SCOPE, async (snapshots) => {
      received = snapshots;
      return null;
    });

    expect(received).toBe(source.expectedDelegate());
  });

  it("returns the operation's result unchanged", async () => {
    const source = new RecordingTransactionSource();
    const runner = new PrismaScoredBifSnapshotScopeRunner(source);

    const result = await runner.runInScope(SCOPE, async () => ({ rows: 3 }));

    expect(result).toEqual({ rows: 3 });
  });

  it('propagates a failure from the operation without classifying it', async () => {
    const source = new RecordingTransactionSource();
    const runner = new PrismaScoredBifSnapshotScopeRunner(source);
    const failure = Object.assign(new Error('unique constraint'), { code: 'P2002' });

    await expect(
      runner.runInScope(SCOPE, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });

  it('propagates a failure from opening the transaction', async () => {
    const failure = new Error('could not connect');
    const runner = new PrismaScoredBifSnapshotScopeRunner({
      async $transaction() {
        throw failure;
      },
    });

    await expect(runner.runInScope(SCOPE, async () => null)).rejects.toBe(failure);
  });

  it('does not run the operation when applying a setting fails', async () => {
    const failure = new Error('set_config failed');
    let operationRan = false;

    const runner = new PrismaScoredBifSnapshotScopeRunner({
      async $transaction<T>(
        operation: (tx: ScoredBifSnapshotScopeTransaction) => Promise<T>,
      ): Promise<T> {
        return operation({
          async $executeRaw(): Promise<unknown> {
            throw failure;
          },
          scoredBifSnapshot: new FakeScoredBifSnapshotDelegate(),
        });
      },
    });

    await expect(
      runner.runInScope(SCOPE, async () => {
        operationRan = true;
        return null;
      }),
    ).rejects.toBe(failure);
    expect(operationRan).toBe(false);
  });
});

describe('PrismaScoredBifSnapshotScopeRunner purity', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../prisma-scored-bif-snapshot-scope-runner.ts', import.meta.url)),
    'utf8',
  );

  /** Doc comments legitimately name forbidden symbols — scan code only. */
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('reads the module source it claims to scan', () => {
    expect(source.length).toBeGreaterThan(0);
    expect(code).toContain('class PrismaScoredBifSnapshotScopeRunner');
  });

  it.each([
    'new Date(',
    'Date.now(',
    'Math.random(',
    'performance.now(',
    'fetch(',
    'node:fs',
    'node:crypto',
    'process.env',
    '@prisma/client',
    '@age/persistence',
    'localStorage',
  ])('does not reference %s', (forbidden) => {
    expect(code).not.toContain(forbidden);
  });

  it.each(['$executeRawUnsafe', '$queryRawUnsafe', '$connect', '$disconnect'])(
    'does not reach for %s',
    (forbidden) => {
      expect(code).not.toContain(forbidden);
    },
  );

  it('never widens the delegate with a mutating operation', () => {
    for (const mutation of ['update', 'upsert', 'delete']) {
      expect(code).not.toContain(`${mutation}(`);
    }
  });
});
