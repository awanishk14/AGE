import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as packageEntrypoint from '../index';
import {
  SCORED_BIF_SNAPSHOT_RECORD_VERSION,
  normalizeScoredBifSnapshotRecord,
  scoredBifSnapshotRecordSchema,
  scoredBifSnapshotSeriesKeyOf,
  type ScoredBifSnapshotRecord,
  type ScoredBifSnapshotRepository,
} from '../scored-bif-snapshot-repository';
import { InMemoryScoredBifSnapshotRepository } from '../in-memory-scored-bif-snapshot-repository';
import { toScoredBifSnapshot } from '../scored-bif-snapshot';
import type { ScoredBifContext } from '../scored-bif-context';
import { produceScoredBifContext } from '../produce-scored-bif-context';
import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '../sample-profile';

const CONSTRUCTED_AT = new Date('2026-07-15T09:30:00.000Z');

const MAPPER_OPTIONS = {
  organizationId: 'org-northwind',
  constructedAt: CONSTRUCTED_AT,
  changedBy: 'analyst@example.com',
} as const;

/** Scope as a caller would take it off a `ClientContext` — never off the payload. */
const SCOPE = {
  clientId: 'client-northwind',
  organizationId: 'org-northwind',
} as const;

/** The real scored sample context, built from the delivered pipeline. */
function sampleContext(): ScoredBifContext {
  return produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, MAPPER_OPTIONS).context;
}

function record(
  overrides: Partial<ScoredBifSnapshotRecord> = {},
  context: ScoredBifContext = sampleContext(),
): ScoredBifSnapshotRecord {
  return {
    ...SCOPE,
    bifId: context.bifId,
    snapshotId: 'snap-1',
    capturedAt: '2026-07-15T09:30:00.000Z',
    snapshot: toScoredBifSnapshot(context),
    ...overrides,
  };
}

function seriesKeyOf(base: ScoredBifSnapshotRecord) {
  return { clientId: base.clientId, organizationId: base.organizationId, bifId: base.bifId };
}

describe('ScoredBifSnapshotRepository port', () => {
  describe('record contract', () => {
    it('accepts a well-formed record built from the real pipeline', () => {
      expect(() => scoredBifSnapshotRecordSchema.parse(record())).not.toThrow();
      expect(SCORED_BIF_SNAPSHOT_RECORD_VERSION).toBe('1.0.0');
    });

    it('requires every identity component, so nothing is stored unscoped', () => {
      for (const field of ['clientId', 'organizationId', 'bifId', 'snapshotId'] as const) {
        expect(
          () => scoredBifSnapshotRecordSchema.parse(record({ [field]: '' })),
          `${field} must be required`,
        ).toThrow();
      }
    });

    it('requires clientId even though the BIF payload carries only an organization', () => {
      // ADR-0030: snapshot persistence is client-scoped platform data.
      const context = sampleContext();
      expect(Object.prototype.hasOwnProperty.call(context, 'clientId')).toBe(false);
      expect(() =>
        scoredBifSnapshotRecordSchema.parse({ ...record(), clientId: undefined }),
      ).toThrow();
    });

    it('pins capturedAt to a canonical ISO-8601 UTC instant', () => {
      for (const bad of [
        '2026-07-15',
        '2026-07-15T09:30:00Z',
        '2026-07-15T09:30:00.000+01:00',
        'yesterday',
        '',
      ]) {
        expect(
          () => scoredBifSnapshotRecordSchema.parse(record({ capturedAt: bad })),
          `capturedAt '${bad}' must be rejected`,
        ).toThrow();
      }
      expect(() =>
        scoredBifSnapshotRecordSchema.parse(record({ capturedAt: '2026-07-15T09:30:00.000Z' })),
      ).not.toThrow();
    });

    it('exposes no update and no delete on the port type (ADR-0030)', () => {
      const repository: ScoredBifSnapshotRepository = new InMemoryScoredBifSnapshotRepository();
      const surface = repository as unknown as Record<string, unknown>;

      for (const forbidden of ['update', 'delete', 'softDelete', 'remove', 'save', 'upsert']) {
        expect(typeof surface[forbidden], `port must not expose ${forbidden}`).toBe('undefined');
      }
      expect(typeof repository.append).toBe('function');
    });
  });

  describe('series key derivation', () => {
    it('is stable and scope-sensitive', () => {
      const key = seriesKeyOf(record());
      expect(scoredBifSnapshotSeriesKeyOf(key)).toBe(scoredBifSnapshotSeriesKeyOf({ ...key }));
      expect(scoredBifSnapshotSeriesKeyOf({ ...key, clientId: 'client-other' })).not.toBe(
        scoredBifSnapshotSeriesKeyOf(key),
      );
    });

    it('cannot be made to collide by ids containing the delimiter', () => {
      const left = scoredBifSnapshotSeriesKeyOf({
        clientId: 'a|b',
        organizationId: 'c',
        bifId: 'd',
      });
      const right = scoredBifSnapshotSeriesKeyOf({
        clientId: 'a',
        organizationId: 'b|c',
        bifId: 'd',
      });
      expect(left).not.toBe(right);
    });
  });

  describe('normalization at the boundary', () => {
    it('rejects a snapshot whose field values could not survive storage', () => {
      const context = sampleContext();
      const poisoned = JSON.parse(JSON.stringify(context)) as ScoredBifContext;
      (poisoned.sections[0]!.fields[0] as { value: unknown }).value = new Date();

      expect(() =>
        normalizeScoredBifSnapshotRecord(
          record({ snapshot: { snapshotVersion: '1.0.0', context: poisoned } }),
        ),
      ).toThrow(/Date/);
    });

    it('returns a copy the caller can no longer reach into', () => {
      const context = sampleContext();
      const mutable = JSON.parse(JSON.stringify(context)) as ScoredBifContext;
      const stored = normalizeScoredBifSnapshotRecord(
        record({ snapshot: { snapshotVersion: '1.0.0', context: mutable } }),
      );

      (mutable as { bifConfidenceScore: number }).bifConfidenceScore = 99;

      expect(stored.snapshot.context.bifConfidenceScore).toBe(17);
      expect(stored.snapshot.context).not.toBe(mutable);
    });

    it('preserves omitted sections as omitted and absent optionals as absent', () => {
      const stored = normalizeScoredBifSnapshotRecord(record());
      const { context } = stored.snapshot;

      expect(context.sections).toHaveLength(7);
      expect(context.omittedSections).toHaveLength(5);
      expect(context.sections.length + context.omittedSections.length).toBe(
        context.metadata.canonicalSectionCount,
      );
      expect(context.bifConfidenceScore).toBe(17);
      expect(context.bifCompletenessScore).toBe(12);
    });
  });
});

describe('InMemoryScoredBifSnapshotRepository', () => {
  it('appends a snapshot and reads it back by full identity', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();
    const base = record();

    await repository.append(base);
    const found = await repository.findBySnapshotId({
      ...seriesKeyOf(base),
      snapshotId: 'snap-1',
    });

    expect(found?.snapshotId).toBe('snap-1');
    expect(found?.snapshot.context.bifConfidenceScore).toBe(17);
  });

  it('returns null rather than inventing a record that was never appended', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();
    const base = record();

    expect(
      await repository.findBySnapshotId({ ...seriesKeyOf(base), snapshotId: 'missing' }),
    ).toBeNull();
    expect(await repository.findLatest(seriesKeyOf(base))).toBeNull();
    expect(await repository.listSeries(seriesKeyOf(base))).toEqual([]);
  });

  it('keeps every re-scoring run instead of overwriting history', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();
    const base = record();

    await repository.append(base);
    await repository.append(
      record({ snapshotId: 'snap-2', capturedAt: '2026-07-16T09:30:00.000Z' }),
    );
    await repository.append(
      record({ snapshotId: 'snap-3', capturedAt: '2026-07-17T09:30:00.000Z' }),
    );

    const series = await repository.listSeries(seriesKeyOf(base));
    expect(series.map((entry) => entry.snapshotId)).toEqual(['snap-1', 'snap-2', 'snap-3']);
  });

  it('rejects re-using a snapshotId within a series', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();

    await repository.append(record());
    await expect(
      repository.append(record({ capturedAt: '2026-07-20T09:30:00.000Z' })),
    ).rejects.toThrow(/append-only/);

    const series = await repository.listSeries(seriesKeyOf(record()));
    expect(series).toHaveLength(1);
    expect(series[0]?.capturedAt).toBe('2026-07-15T09:30:00.000Z');
  });

  it('orders a series by capturedAt regardless of append order', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();
    const base = record();

    await repository.append(record({ snapshotId: 'c', capturedAt: '2026-07-17T09:30:00.000Z' }));
    await repository.append(record({ snapshotId: 'a', capturedAt: '2026-07-15T09:30:00.000Z' }));
    await repository.append(record({ snapshotId: 'b', capturedAt: '2026-07-16T09:30:00.000Z' }));

    const series = await repository.listSeries(seriesKeyOf(base));
    expect(series.map((entry) => entry.snapshotId)).toEqual(['a', 'b', 'c']);
    expect((await repository.findLatest(seriesKeyOf(base)))?.snapshotId).toBe('c');
  });

  it('breaks a capturedAt tie deterministically by snapshotId', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();
    const base = record();
    const sameInstant = '2026-07-15T09:30:00.000Z';

    await repository.append(record({ snapshotId: 'snap-b', capturedAt: sameInstant }));
    await repository.append(record({ snapshotId: 'snap-a', capturedAt: sameInstant }));

    expect((await repository.listSeries(seriesKeyOf(base))).map((e) => e.snapshotId)).toEqual([
      'snap-a',
      'snap-b',
    ]);
    expect((await repository.findLatest(seriesKeyOf(base)))?.snapshotId).toBe('snap-b');
  });

  it('never returns one client its neighbour’s snapshots', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();
    const mine = record();
    const theirs = record({ clientId: 'client-other' });

    await repository.append(mine);
    await repository.append(theirs);

    expect(await repository.listSeries(seriesKeyOf(mine))).toHaveLength(1);
    expect(
      await repository.findBySnapshotId({ ...seriesKeyOf(theirs), snapshotId: 'snap-1' }),
    ).not.toBeNull();
    expect(
      await repository.findBySnapshotId({
        ...seriesKeyOf(mine),
        organizationId: 'org-elsewhere',
        snapshotId: 'snap-1',
      }),
    ).toBeNull();
  });

  it('separates series by bifId within one scope', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();
    const base = record();

    await repository.append(base);
    await repository.append(record({ bifId: 'bif-other', snapshotId: 'snap-1' }));

    expect(await repository.listSeries(seriesKeyOf(base))).toHaveLength(1);
    expect(await repository.listSeries({ ...SCOPE, bifId: 'bif-other' })).toHaveLength(1);
  });

  it('rejects an invalid record before it is stored', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();

    await expect(repository.append(record({ snapshotId: '' }))).rejects.toThrow();
    await expect(repository.append(record({ capturedAt: 'yesterday' }))).rejects.toThrow(
      /capturedAt/,
    );
    expect(await repository.listSeries(seriesKeyOf(record()))).toEqual([]);
  });

  it('is unaffected by mutating the record after it was appended', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();
    const mutable = record();

    await repository.append(mutable);
    (mutable as { snapshotId: string }).snapshotId = 'tampered';

    const series = await repository.listSeries(seriesKeyOf(record()));
    expect(series[0]?.snapshotId).toBe('snap-1');
  });

  it('never promotes a BIF status through the store', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();
    const base = record();

    await repository.append(base);
    const latest = await repository.findLatest(seriesKeyOf(base));

    expect(latest?.snapshot.context.bifStatus).toBe(base.snapshot.context.bifStatus);
  });
});

describe('stage-2 boundaries', () => {
  function sourceOf(file: string): string {
    const here = dirname(fileURLToPath(import.meta.url));
    return readFileSync(join(here, '..', file), 'utf8');
  }

  /**
   * Comment-stripped source. Both modules discuss `@age/persistence` and
   * durability at length in their doc comments — deliberately, since the
   * reasoning is the point — so the guard inspects executable code only.
   */
  function code(file: string): string {
    return sourceOf(file)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
  }

  const MODULES = [
    'scored-bif-snapshot-repository.ts',
    'in-memory-scored-bif-snapshot-repository.ts',
  ] as const;

  it('reads no clock and no randomness', () => {
    for (const file of MODULES) {
      for (const forbidden of ['new Date(', 'Date.now(', 'Math.random(', 'performance.now(']) {
        expect(code(file).includes(forbidden), `${file} must not contain ${forbidden}`).toBe(false);
      }
    }
  });

  it('performs no durable write of any kind — stage 3 is not authorized', () => {
    for (const file of MODULES) {
      for (const forbidden of [
        'fetch(',
        'node:fs',
        'node:path',
        'process.env',
        'localStorage',
        '@prisma/client',
        'PrismaClient',
        '@age/persistence',
        '@age/business-knowledge-graph',
      ]) {
        expect(code(file).includes(forbidden), `${file} must not contain ${forbidden}`).toBe(false);
      }
    }
  });

  it('declares no update or delete operation in the port source', () => {
    const port = code('scored-bif-snapshot-repository.ts');
    for (const forbidden of ['update(', 'delete(', 'softDelete(', 'upsert(']) {
      expect(port.includes(forbidden), `port must not declare ${forbidden}`).toBe(false);
    }
    expect(port.includes('append(')).toBe(true);
  });

  it('never promotes a BIF status', () => {
    for (const file of MODULES) {
      expect(code(file).includes('BIFStatus.Active')).toBe(false);
    }
  });
});

describe('package entrypoint', () => {
  it('exports the stage-2 port and adapter', () => {
    expect(typeof packageEntrypoint.InMemoryScoredBifSnapshotRepository).toBe('function');
    expect(typeof packageEntrypoint.normalizeScoredBifSnapshotRecord).toBe('function');
    expect(typeof packageEntrypoint.scoredBifSnapshotSeriesKeyOf).toBe('function');
    expect(packageEntrypoint.SCORED_BIF_SNAPSHOT_RECORD_VERSION).toBe(
      SCORED_BIF_SNAPSHOT_RECORD_VERSION,
    );
    expect(packageEntrypoint.scoredBifSnapshotRecordSchema).toBeDefined();
  });
});
