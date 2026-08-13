import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { StoredSourceObservation } from '@age/source-observation';
import { describe, expect, it } from 'vitest';

import { ScopedSourceObservationRepository } from '../scoped-source-observation-repository';
import type { SourceObservationDelegate } from '../source-observation-delegate';
import {
  PrismaSourceObservationScopeRunner,
  type SourceObservationScopeTransaction,
} from '../source-observation-scope-runner';

/**
 * The scoped path, exercised.
 *
 * ⚠️ WHAT THESE PROVE THAT THE REPOSITORY SPEC CANNOT: that the scope setting
 * is applied BEFORE any row is touched, that it is a BOUND PARAMETER rather
 * than spliced SQL, that the delegate used is the one bound to the very
 * transaction that was scoped, and 🚫 that `age.client_id` is never set here.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const OBSERVATION: StoredSourceObservation = {
  observationId: 'observation-fictional-1',
  organizationId: 'org-fictional-1',
  sourceSystem: 'example-visibility-system',
  sourceInstance: 'instance-fictional-1',
  sourceRecordId: 'record-fictional-1',
  subject: { kind: 'modelled', subjectKind: 'service', label: 'Widget Polishing' },
  claim: { direction: 'down', materiality: 'moderate' },
  period: {
    observedAt: '2026-07-31T00:00:00.000Z',
    windowStart: '2026-07-01T00:00:00.000Z',
    windowEnd: '2026-07-31T00:00:00.000Z',
  },
  claimKind: 'raw-observation',
  recordedAt: '2026-08-05T00:00:00.000Z',
};

interface Recorded {
  readonly log: string[];
  readonly statements: Array<{ readonly text: string; readonly values: unknown[] }>;
}

/**
 * A transaction source that records the ORDER of everything, and hands out a
 * delegate that is identifiable as belonging to this transaction.
 */
function recordingSource(rows: readonly unknown[] = []) {
  const recorded: Recorded = { log: [], statements: [] };

  const delegate: SourceObservationDelegate = {
    create: async ({ data }) => {
      recorded.log.push(`create:${data.observationId}`);
      return data;
    },
    findMany: async ({ where }) => {
      recorded.log.push(`findMany:${where.organizationId}`);
      return [...rows];
    },
  };

  const source = {
    $transaction: async <T>(operation: (tx: SourceObservationScopeTransaction) => Promise<T>) => {
      recorded.log.push('begin');

      const tx: SourceObservationScopeTransaction = {
        $executeRaw: async (query: TemplateStringsArray, ...values: unknown[]) => {
          recorded.log.push('set_config');
          recorded.statements.push({ text: query.join('?'), values });
          return 1;
        },
        sourceObservation: delegate,
      };

      const result = await operation(tx);
      recorded.log.push('commit');
      return result;
    },
  };

  return { recorded, source, delegate };
}

/** A delegate that must NEVER be used: it belongs to no transaction. */
const UNSCOPED_DELEGATE: SourceObservationDelegate = {
  create: async () => {
    throw new Error('An unscoped delegate was used. This read or write would escape the scope.');
  },
  findMany: async () => {
    throw new Error('An unscoped delegate was used. This read or write would escape the scope.');
  },
};

describe('ScopedSourceObservationRepository', () => {
  it('🛑 scopes the transaction BEFORE it reads — an unscoped read returns zero rows, not an error', async () => {
    const { recorded, source } = recordingSource([]);
    const repository = new ScopedSourceObservationRepository(
      new PrismaSourceObservationScopeRunner(source),
    );

    await repository.listForOrganization('org-fictional-1');

    // ⚠️ Order is the whole assertion. `set_config` after `findMany` would read
    // outside the scope and return an EMPTY LIST, which renders as "nothing has
    // been relayed" — a missing scope must never be able to look like an honest
    // empty answer.
    expect(recorded.log).toEqual(['begin', 'set_config', 'findMany:org-fictional-1', 'commit']);
  });

  it('scopes before it writes, too', async () => {
    const { recorded, source } = recordingSource();
    const repository = new ScopedSourceObservationRepository(
      new PrismaSourceObservationScopeRunner(source),
    );

    await repository.append(OBSERVATION);

    expect(recorded.log).toEqual([
      'begin',
      'set_config',
      'create:observation-fictional-1',
      'commit',
    ]);
  });

  it('🚫 passes the organisation as a BOUND PARAMETER, never spliced into SQL', async () => {
    const { recorded, source } = recordingSource([]);
    const repository = new ScopedSourceObservationRepository(
      new PrismaSourceObservationScopeRunner(source),
    );

    await repository.listForOrganization("org-fictional-1'; DROP TABLE source_observations; --");

    expect(recorded.statements).toHaveLength(1);
    const statement = recorded.statements[0]!;
    // The id appears only in the VALUES, never in the statement text.
    expect(statement.values).toEqual(["org-fictional-1'; DROP TABLE source_observations; --"]);
    expect(statement.text).not.toContain('org-fictional-1');
    expect(statement.text).toContain("set_config('age.organization_id'");
  });

  it('🛑 sets the organisation and NOTHING ELSE — there is no client_id column to scope', async () => {
    const { recorded, source } = recordingSource([]);
    const repository = new ScopedSourceObservationRepository(
      new PrismaSourceObservationScopeRunner(source),
    );

    await repository.listForOrganization('org-fictional-1');

    // ⚠️ Exactly ONE setting. `age.client_id` here would scope against a column
    // that does not exist (ADR-0062 D1) and would be the first half of adding
    // one.
    expect(recorded.statements).toHaveLength(1);
    expect(recorded.statements[0]!.text).not.toContain('age.client_id');
  });

  it('🚫 uses the delegate bound to the transaction, never one from outside it', async () => {
    const { recorded, source, delegate } = recordingSource([]);
    // A source whose transaction hands back the UNSCOPED delegate instead.
    const escaping = {
      $transaction: async <T>(operation: (tx: SourceObservationScopeTransaction) => Promise<T>) =>
        source.$transaction((tx) =>
          operation({ $executeRaw: tx.$executeRaw, sourceObservation: UNSCOPED_DELEGATE }),
        ),
    };

    const repository = new ScopedSourceObservationRepository(
      new PrismaSourceObservationScopeRunner(escaping),
    );

    await expect(repository.listForOrganization('org-fictional-1')).rejects.toThrow(
      /unscoped delegate/i,
    );
    // The in-transaction delegate was never reached, which is what the runner
    // is supposed to guarantee it always uses.
    expect(recorded.log).not.toContain('findMany:org-fictional-1');
    expect(delegate).toBeDefined();
  });

  it('carries a scoped read back unchanged, 🚫 never re-ordering or filtering it', async () => {
    const row = {
      observationId: 'observation-fictional-1',
      organizationId: 'org-fictional-1',
      sourceSystem: 'example-visibility-system',
      sourceInstance: 'instance-fictional-1',
      sourceRecordId: 'record-fictional-1',
      subjectDisposition: 'modelled',
      subjectKind: 'service',
      subjectLabel: 'Widget Polishing',
      claimDirection: 'down',
      claimMateriality: 'moderate',
      claimKind: 'raw-observation',
      observedAt: '2026-07-31T00:00:00.000Z',
      windowStart: '2026-07-01T00:00:00.000Z',
      windowEnd: '2026-07-31T00:00:00.000Z',
      recordedAt: '2026-08-05T00:00:00.000Z',
    };

    const { source } = recordingSource([row]);
    const repository = new ScopedSourceObservationRepository(
      new PrismaSourceObservationScopeRunner(source),
    );

    const observations = await repository.listForOrganization('org-fictional-1');

    expect(observations).toEqual([OBSERVATION]);
  });
});

describe('🚫 the scoped path cannot grow a mutation', () => {
  const sourceOf = (name: string): string => {
    const path = fileURLToPath(new URL(`../${name}`, import.meta.url));
    return readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  };

  it('declares no update, upsert, delete or session-level scope anywhere', () => {
    const modules = [
      'scoped-source-observation-repository.ts',
      'source-observation-scope-runner.ts',
    ];
    let scanned = 0;

    for (const name of modules) {
      const text = sourceOf(name);
      // ⚠️ The scan must have something to scan: an empty read would report
      // compliance.
      expect(text.length, name).toBeGreaterThan(200);
      scanned += 1;

      for (const banned of [
        'update',
        'upsert',
        'delete',
        'findUnique',
        // 🚫 The unsafe raw form is what would let a scope id be concatenated.
        '$executeRawUnsafe',
        '$queryRawUnsafe',
        // 🚫 A session-level SET outlives its transaction and leaks across a pool.
        'SET age.',
        'clientId',
        'client_id',
      ]) {
        expect(text, `${name} must not contain ${banned}`).not.toContain(banned);
      }
    }

    expect(scanned).toBe(modules.length);
  });
});
