import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as packageEntrypoint from '../index';
import type {
  ScoredBifSnapshotScope,
  ScoredBifSnapshotScopeRunner,
} from '../scored-bif-snapshot-scope-runner';
import { ScopedScoredBifSnapshotRepository } from '../scoped-scored-bif-snapshot-repository';
import { FakeScoredBifSnapshotDelegate } from './fake-scored-bif-snapshot-delegate';
import { keyOf, makeRecord, seriesKeyOf, SCOPE } from './scored-bif-snapshot-repository-contract';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCOPED_SOURCE = readFileSync(
  join(HERE, '..', 'scoped-scored-bif-snapshot-repository.ts'),
  'utf8',
);

/** The RLS migration this adapter exists to satisfy (ADR-0033). */
const RLS_MIGRATION = readFileSync(
  join(
    HERE,
    '..',
    '..',
    '..',
    'persistence',
    'src',
    'prisma',
    'migrations',
    '20260726000000_scored_bif_snapshots_rls',
    'migration.sql',
  ),
  'utf8',
);

/**
 * The migration's executable SQL, with `--` comment lines removed. The comments
 * name the columns the table must never grow, so scanning the whole file for
 * them would flag the very sentence forbidding them.
 */
const RLS_SQL = RLS_MIGRATION.split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

/**
 * A runner that records every scope it was asked for and hands the operation a
 * delegate. It emulates only the property the real one must have: the operation
 * runs inside exactly one scoped unit of work.
 */
class RecordingScopeRunner implements ScoredBifSnapshotScopeRunner {
  readonly scopes: ScoredBifSnapshotScope[] = [];
  /** Depth at the moment each operation ran — proves it ran inside the scope. */
  readonly depths: number[] = [];
  private depth = 0;

  constructor(readonly delegate = new FakeScoredBifSnapshotDelegate()) {}

  async runInScope<T>(
    scope: ScoredBifSnapshotScope,
    operation: (snapshots: FakeScoredBifSnapshotDelegate) => Promise<T>,
  ): Promise<T> {
    this.scopes.push(scope);
    this.depth += 1;
    try {
      this.depths.push(this.depth);
      return await operation(this.delegate);
    } finally {
      this.depth -= 1;
    }
  }
}

function newRepository(): {
  repository: ScopedScoredBifSnapshotRepository;
  runner: RecordingScopeRunner;
} {
  const runner = new RecordingScopeRunner();
  return { repository: new ScopedScoredBifSnapshotRepository(runner), runner };
}

describe('ScopedScoredBifSnapshotRepository', () => {
  describe('the transaction boundary', () => {
    it('runs every port operation inside exactly one scoped unit of work', async () => {
      const { repository, runner } = newRepository();
      const record = makeRecord();

      await repository.append(record);
      await repository.findBySnapshotId(keyOf(record));
      await repository.listSeries(seriesKeyOf(record));
      await repository.findLatest(seriesKeyOf(record));

      expect(runner.scopes).toHaveLength(4);
      // Each operation ran at depth 1: inside a scope, and never nested inside
      // another one, which would mean two transactions for one query.
      expect(runner.depths).toEqual([1, 1, 1, 1]);
    });

    it('issues no query outside a scope', async () => {
      const { repository, runner } = newRepository();

      await repository.append(makeRecord());

      expect(runner.delegate.calls).toHaveLength(1);
      expect(runner.scopes).toHaveLength(1);
    });
  });

  describe('the scope it applies', () => {
    it('takes both ids from the key, for every operation', async () => {
      const { repository, runner } = newRepository();
      const record = makeRecord();

      await repository.append(record);
      await repository.findBySnapshotId(keyOf(record));
      await repository.listSeries(seriesKeyOf(record));
      await repository.findLatest(seriesKeyOf(record));

      for (const scope of runner.scopes) {
        expect(scope).toEqual({
          clientId: SCOPE.clientId,
          organizationId: SCOPE.organizationId,
        });
      }
    });

    it('applies a different scope for a different client, not a cached one', async () => {
      const { repository, runner } = newRepository();

      await repository.append(makeRecord());
      await repository.append(makeRecord({ clientId: 'client-other', snapshotId: 'snap-2' }));

      expect(runner.scopes[1]).toEqual({
        clientId: 'client-other',
        organizationId: SCOPE.organizationId,
      });
    });

    it('never derives the scope from the snapshot payload', async () => {
      const { repository, runner } = newRepository();

      // The payload's own `bifId` is present and irrelevant; the context carries
      // no client or organization at all. The scope must come from the key
      // (ADR-0031 D5, ADR-0033 D7).
      const record = makeRecord({ clientId: 'client-from-key', organizationId: 'org-from-key' });
      await repository.append(record);

      expect(runner.scopes[0]).toEqual({
        clientId: 'client-from-key',
        organizationId: 'org-from-key',
      });
      expect(SCOPED_SOURCE).not.toContain('record.snapshot');
      expect(SCOPED_SOURCE).not.toContain('context.');
    });
  });

  describe('the port it implements', () => {
    it('still exposes append and the three reads, and nothing that mutates', () => {
      const { repository } = newRepository();
      const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(repository) as object)
        .filter((name) => name !== 'constructor' && name !== 'inScope')
        .sort();

      expect(surface).toEqual(['append', 'findBySnapshotId', 'findLatest', 'listSeries']);
      for (const forbidden of ['update', 'delete', 'upsert', 'remove']) {
        expect(surface).not.toContain(forbidden);
      }
    });

    it('reads back what it appended, through the scope', async () => {
      const { repository } = newRepository();
      const record = makeRecord();

      await repository.append(record);

      expect(await repository.findBySnapshotId(keyOf(record))).toEqual(record);
      expect(await repository.findLatest(seriesKeyOf(record))).toEqual(record);
      expect(await repository.listSeries(seriesKeyOf(record))).toEqual([record]);
    });

    it('still rejects a duplicate identity as append-only', async () => {
      const { repository } = newRepository();
      const record = makeRecord();

      await repository.append(record);

      await expect(repository.append(record)).rejects.toThrow(/append-only/i);
    });
  });

  describe('purity', () => {
    it('reads no clock, no randomness and opens no connection of its own', () => {
      for (const forbidden of [
        'new Date(',
        'Date.now(',
        'Math.random(',
        'performance.now(',
        'fetch(',
        'node:fs',
        'process.env',
        '@prisma/client',
        '$transaction',
        '$executeRaw',
      ]) {
        expect(SCOPED_SOURCE).not.toContain(forbidden);
      }
    });

    it('is exported from the package entrypoint', () => {
      expect(packageEntrypoint).toHaveProperty('ScopedScoredBifSnapshotRepository');
    });
  });

  describe('the migration it is built against', () => {
    it('enables and forces row-level security', () => {
      expect(RLS_MIGRATION).toContain('ENABLE ROW LEVEL SECURITY');
      expect(RLS_MIGRATION).toContain('FORCE ROW LEVEL SECURITY');
    });

    it('writes both ids into both policies', () => {
      for (const policy of ['FOR SELECT', 'FOR INSERT']) {
        expect(RLS_MIGRATION).toContain(policy);
      }
      // Both ids in both predicates: two `current_setting` reads per policy.
      expect(RLS_MIGRATION.match(/current_setting\('age\.client_id', true\)/g)).toHaveLength(2);
      expect(RLS_MIGRATION.match(/current_setting\('age\.organization_id', true\)/g)).toHaveLength(
        2,
      );
    });

    it('grants only SELECT and INSERT, and adds no mutation path', () => {
      expect(RLS_SQL).toContain('GRANT SELECT, INSERT ON TABLE "scored_bif_snapshots"');
      for (const forbidden of [
        'GRANT UPDATE',
        'GRANT DELETE',
        'GRANT TRUNCATE',
        'GRANT ALL',
        'TO PUBLIC',
        'ADD COLUMN',
        'DROP COLUMN',
        'updated_at',
        'deleted_at',
      ]) {
        expect(RLS_SQL).not.toContain(forbidden);
      }
    });

    it('creates no role — roles are environment identities, not schema (ADR-0033 D11)', () => {
      expect(RLS_SQL).not.toContain('CREATE ROLE');
      expect(RLS_SQL).not.toContain('CREATE USER');
      expect(RLS_SQL).not.toContain('PASSWORD');
    });
  });
});
