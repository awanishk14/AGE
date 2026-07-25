import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as packageEntrypoint from '../index';
import { PrismaScoredBifSnapshotRepository } from '../prisma-scored-bif-snapshot-repository';
import { isUniqueConstraintViolation } from '../scored-bif-snapshot-delegate';
import {
  fromScoredBifSnapshotRow,
  toScoredBifSnapshotRow,
  type ScoredBifSnapshotRow,
} from '../scored-bif-snapshot-row';
import { FakeScoredBifSnapshotDelegate } from './fake-scored-bif-snapshot-delegate';
import {
  keyOf,
  makeRecord,
  sampleContext,
  seriesKeyOf,
  SCOPE,
} from './scored-bif-snapshot-repository-contract';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADAPTER_SOURCE = readFileSync(
  join(HERE, '..', 'prisma-scored-bif-snapshot-repository.ts'),
  'utf8',
);
const ROW_SOURCE = readFileSync(join(HERE, '..', 'scored-bif-snapshot-row.ts'), 'utf8');
const DELEGATE_SOURCE = readFileSync(join(HERE, '..', 'scored-bif-snapshot-delegate.ts'), 'utf8');
const PACKAGE_JSON = readFileSync(join(HERE, '..', '..', 'package.json'), 'utf8');

/** The single Prisma schema of record (ADR-0031 Decision 3). */
const SCHEMA_OF_RECORD = readFileSync(
  join(HERE, '..', '..', '..', 'persistence', 'src', 'prisma', 'schema.prisma'),
  'utf8',
);

function modelBlock(): string {
  const start = SCHEMA_OF_RECORD.indexOf('model ScoredBifSnapshot {');
  expect(start, 'the schema of record must declare the ScoredBifSnapshot model').toBeGreaterThan(
    -1,
  );
  return SCHEMA_OF_RECORD.slice(start, SCHEMA_OF_RECORD.indexOf('}', start));
}

/** Module specifiers actually imported, so prose in a doc comment is not a dependency. */
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s+'([^']+)'/g)].map((match) => match[1] ?? '');
}

describe('PrismaScoredBifSnapshotRepository', () => {
  describe('the schema of record', () => {
    it('declares the composite primary key and nothing else as identity', () => {
      expect(modelBlock()).toContain('@@id([clientId, organizationId, bifId, snapshotId])');
      // No surrogate id: the logical identity IS the key (ADR-0031 D4).
      expect(modelBlock()).not.toMatch(/^\s*id\s+String\s+@id/m);
    });

    it('declares no updatedAt, version, deletedAt or current flag', () => {
      // Field declarations only: `scoringVersion` is an allowed attribute, and a
      // substring scan would have caught it and called the table mutable.
      const fields = modelBlock()
        .split('\n')
        .map((line) => line.trim().split(/\s+/)[0] ?? '')
        .filter((name) => name.length > 0 && !name.startsWith('@') && name !== 'model');

      for (const forbidden of [
        'updatedAt',
        'version',
        'deletedAt',
        'isCurrent',
        'current',
        'status',
      ]) {
        expect(fields, `${forbidden} must not exist on the snapshot table`).not.toContain(
          forbidden,
        );
      }

      expect(fields).toEqual([
        'clientId',
        'organizationId',
        'bifId',
        'snapshotId',
        'capturedAt',
        'snapshotVersion',
        'scoringVersion',
        'context',
      ]);
      expect(modelBlock()).not.toContain('@updatedAt');
    });

    it('generates no server-side time and no default, so capturedAt stays caller-supplied', () => {
      const block = modelBlock();

      expect(block).not.toContain('now()');
      expect(block).not.toContain('@default');
      expect(block).not.toContain('@updatedAt');
      expect(block).toContain('capturedAt      String');
    });

    it('stores the context as one Json column, never shredded', () => {
      expect(modelBlock()).toContain('context         Json');
    });

    it('makes scoringVersion a nullable attribute, never part of the key', () => {
      const block = modelBlock();

      expect(block).toContain('scoringVersion  String?');
      expect(block).not.toContain(
        '@@id([clientId, organizationId, bifId, snapshotId, scoringVersion]',
      );
    });

    it('indexes the series for the latest query', () => {
      expect(modelBlock()).toContain(
        '@@index([clientId, organizationId, bifId, capturedAt(sort: Desc), snapshotId(sort: Desc)]',
      );
    });

    it('holds no foreign key to clients, organizations or BKG tables', () => {
      expect(modelBlock()).not.toContain('@relation');
    });

    it('is the only schema this package relies on — the package declares no schema of its own', () => {
      expect(PACKAGE_JSON).not.toContain('prisma');
      expect(PACKAGE_JSON).not.toContain('@prisma/client');
    });
  });

  describe('the delegate it is given', () => {
    it('declares no mutation or deletion method at all', () => {
      for (const forbidden of [
        'update(',
        'updateMany(',
        'upsert(',
        'delete(',
        'deleteMany(',
        'executeRaw',
        'queryRaw',
      ]) {
        expect(DELEGATE_SOURCE, `${forbidden} must not be reachable`).not.toContain(forbidden);
      }
    });

    it('is structural, so the adapter imports no generated Prisma code', () => {
      // Import specifiers, not substrings: these files discuss `@prisma/client`
      // and `PrismaClient` at length in their doc comments, and prose is not a
      // dependency.
      for (const source of [ADAPTER_SOURCE, ROW_SOURCE, DELEGATE_SOURCE]) {
        expect(importSpecifiers(source)).not.toContain('@prisma/client');
      }
    });

    it('recognises only Prisma unique-constraint violations', () => {
      expect(isUniqueConstraintViolation(Object.assign(new Error('dup'), { code: 'P2002' }))).toBe(
        true,
      );
      expect(isUniqueConstraintViolation(Object.assign(new Error('gone'), { code: 'P2025' }))).toBe(
        false,
      );
      expect(isUniqueConstraintViolation(new Error('plain'))).toBe(false);
      expect(isUniqueConstraintViolation(null)).toBe(false);
    });
  });

  describe('the adapter itself', () => {
    it('reads no clock, generates no id and uses no randomness', () => {
      for (const source of [ADAPTER_SOURCE, ROW_SOURCE, DELEGATE_SOURCE]) {
        for (const forbidden of [
          'new Date(',
          'Date.now(',
          'Math.random(',
          'performance.now(',
          'randomUUID',
          'crypto.',
          'fetch(',
          'node:fs',
          'process.env',
        ]) {
          expect(source, `${forbidden} must not appear in adapter code`).not.toContain(forbidden);
        }
      }
    });

    it('never imports @age/capability-kit or @age/bif', () => {
      for (const source of [ADAPTER_SOURCE, ROW_SOURCE, DELEGATE_SOURCE]) {
        const specifiers = importSpecifiers(source);
        expect(specifiers).not.toContain('@age/capability-kit');
        expect(specifiers).not.toContain('@age/bif');
      }

      // Nor as a declared dependency — scope arrives as two ids, structurally.
      const manifest = JSON.parse(PACKAGE_JSON) as {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      };
      expect(Object.keys(manifest.dependencies)).toEqual(['@age/business-discovery-contracts']);
      expect(Object.keys(manifest.devDependencies)).toEqual(['vitest']);
    });

    it('issues only create, findUnique and findMany — never a write beyond insert', async () => {
      const delegate = new FakeScoredBifSnapshotDelegate();
      const repository = new PrismaScoredBifSnapshotRepository(delegate);
      const record = makeRecord();

      await repository.append(record);
      await repository.findBySnapshotId(keyOf(record));
      await repository.listSeries(seriesKeyOf(record));
      await repository.findLatest(seriesKeyOf(record));

      expect([...new Set(delegate.calls.map((call) => call.method))].sort()).toEqual([
        'create',
        'findMany',
        'findUnique',
      ]);
    });

    it('scopes every read query, so a scopeless query cannot be issued', async () => {
      const delegate = new FakeScoredBifSnapshotDelegate();
      const repository = new PrismaScoredBifSnapshotRepository(delegate);
      const record = makeRecord();

      await repository.append(record);
      await repository.listSeries(seriesKeyOf(record));
      await repository.findLatest(seriesKeyOf(record));

      const reads = delegate.calls.filter((call) => call.method === 'findMany');
      expect(reads).toHaveLength(2);
      for (const read of reads) {
        const { where } = read.args as { where: Record<string, string> };
        expect(where.clientId).toBe(SCOPE.clientId);
        expect(where.organizationId).toBe(SCOPE.organizationId);
      }
    });

    it('asks the database for the latest row rather than sorting in memory', async () => {
      const delegate = new FakeScoredBifSnapshotDelegate();
      const repository = new PrismaScoredBifSnapshotRepository(delegate);

      await repository.findLatest({ ...SCOPE, bifId: 'bif-1' });

      const { orderBy, take } = (delegate.calls[0]?.args ?? {}) as {
        orderBy: ReadonlyArray<Record<string, string>>;
        take?: number;
      };
      expect(orderBy).toEqual([{ capturedAt: 'desc' }, { snapshotId: 'desc' }]);
      expect(take).toBe(1);
    });

    it('surfaces a non-duplicate database failure unchanged', async () => {
      const failing = {
        create: async () => {
          throw Object.assign(new Error('connection refused'), { code: 'P1001' });
        },
        findUnique: async () => null,
        findMany: async () => [],
      };
      const repository = new PrismaScoredBifSnapshotRepository(failing);

      // Not rewritten into an append-only message: an outage is not a duplicate.
      await expect(repository.append(makeRecord())).rejects.toThrow('connection refused');
    });
  });

  describe('row mapping', () => {
    it('denormalises scoringVersion into its own column for querying', () => {
      const row = toScoredBifSnapshotRow(makeRecord());

      expect(row.scoringVersion).toBe('1.0.0');
      expect(row.snapshotVersion).toBe('1.0.0');
    });

    it('stores null when the context carries no scoringVersion', () => {
      const base = sampleContext();
      const context = { ...base, metadata: { ...base.metadata, scoringVersion: undefined } };
      const row = toScoredBifSnapshotRow(makeRecord({}, context));

      expect(row.scoringVersion).toBeNull();
    });

    it('takes the scope from the key columns, never from the context', () => {
      const context = sampleContext();
      const row = toScoredBifSnapshotRow(makeRecord({ bifId: 'bif-from-the-key' }, context));

      expect(row.bifId).toBe('bif-from-the-key');
      expect(row.clientId).toBe(SCOPE.clientId);
    });

    it('re-validates a row on the way out, because stored data is untrusted', () => {
      const valid = toScoredBifSnapshotRow(makeRecord());

      expect(() => fromScoredBifSnapshotRow(valid)).not.toThrow();
      // A hand-edited or restored row does not get to bypass the contract.
      expect(() =>
        fromScoredBifSnapshotRow({ ...valid, capturedAt: 'yesterday' } as ScoredBifSnapshotRow),
      ).toThrow();
      expect(() =>
        fromScoredBifSnapshotRow({ ...valid, clientId: '' } as ScoredBifSnapshotRow),
      ).toThrow();
      expect(() =>
        fromScoredBifSnapshotRow({ ...valid, context: { nonsense: true } } as ScoredBifSnapshotRow),
      ).toThrow();
    });
  });

  describe('package entry point', () => {
    it('exports the adapter and its row/delegate contracts, and no fake', () => {
      expect(packageEntrypoint.PrismaScoredBifSnapshotRepository).toBe(
        PrismaScoredBifSnapshotRepository,
      );
      expect(Object.keys(packageEntrypoint).sort()).toEqual([
        'PrismaScoredBifSnapshotRepository',
        'fromScoredBifSnapshotRow',
        'isUniqueConstraintViolation',
        'toScoredBifSnapshotRow',
      ]);
    });
  });
});
