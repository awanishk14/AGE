import { describe, expect, it } from 'vitest';
import {
  produceScoredBifContext,
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  toScoredBifSnapshot,
  type ScoredBifContext,
  type ScoredBifSnapshotRecord,
  type ScoredBifSnapshotRepository,
} from '@age/business-discovery-contracts';

/**
 * The shared contract suite for `ScoredBifSnapshotRepository`.
 *
 * One suite, run against every adapter (ADR-0031 implementation constraints).
 * The in-memory adapter and the durable adapter are not two implementations
 * that happen to look alike — they are one contract, and this file is where
 * that claim is checked. An adapter that passes here is substitutable; one that
 * needs its own weakened expectations is a second contract wearing the port's
 * name.
 *
 * Deliberately storage-agnostic: no SQL, no `Map`, no delegate. Anything that
 * can only be asserted about one adapter belongs in that adapter's own spec.
 */

const MAPPER_OPTIONS = {
  organizationId: 'org-northwind',
  constructedAt: new Date('2026-07-15T09:30:00.000Z'),
  changedBy: 'analyst@example.com',
} as const;

/** Scope as a caller takes it off a `ClientContext` — never off the payload. */
export const SCOPE = {
  clientId: 'client-northwind',
  organizationId: 'org-northwind',
} as const;

/** The real scored sample context, built from the delivered pipeline. */
export function sampleContext(): ScoredBifContext {
  return produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, MAPPER_OPTIONS).context;
}

export function makeRecord(
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

export function seriesKeyOf(record: ScoredBifSnapshotRecord) {
  return {
    clientId: record.clientId,
    organizationId: record.organizationId,
    bifId: record.bifId,
  };
}

export function keyOf(record: ScoredBifSnapshotRecord) {
  return { ...seriesKeyOf(record), snapshotId: record.snapshotId };
}

/**
 * @param adapterName how the suite is labelled in output
 * @param createRepository a fresh, empty repository per test
 */
export function describeScoredBifSnapshotRepositoryContract(
  adapterName: string,
  createRepository: () => ScoredBifSnapshotRepository,
): void {
  describe(`${adapterName} — ScoredBifSnapshotRepository contract`, () => {
    describe('append and read back', () => {
      it('stores an appended snapshot and returns it by full composite identity', async () => {
        const repository = createRepository();
        const record = makeRecord();

        await repository.append(record);

        const found = await repository.findBySnapshotId(keyOf(record));
        expect(found).not.toBeNull();
        expect(found?.snapshotId).toBe('snap-1');
        expect(found?.capturedAt).toBe('2026-07-15T09:30:00.000Z');
        expect(found?.snapshot).toEqual(record.snapshot);
      });

      it('persists and returns the context as a JSON-safe payload, unchanged', async () => {
        const repository = createRepository();
        const record = makeRecord();

        await repository.append(record);
        const found = await repository.findBySnapshotId(keyOf(record));

        // Byte-stable both ways: what a jsonb column can hold, and no more.
        expect(JSON.stringify(found?.snapshot.context)).toBe(
          JSON.stringify(record.snapshot.context),
        );
        expect(found?.snapshot.context.sections.length).toBeGreaterThan(0);
      });

      it('never mutates the record it was handed', async () => {
        const repository = createRepository();
        const record = makeRecord();
        const before = JSON.stringify(record);

        await repository.append(record);

        expect(JSON.stringify(record)).toBe(before);
      });

      it('returns null for a snapshot that was never appended', async () => {
        const repository = createRepository();

        expect(
          await repository.findBySnapshotId({ ...SCOPE, bifId: 'bif-x', snapshotId: 'nope' }),
        ).toBeNull();
      });
    });

    describe('scope is authoritative (ADR-0031 D5)', () => {
      it('cannot be read under a different clientId', async () => {
        const repository = createRepository();
        const record = makeRecord();
        await repository.append(record);

        const foreign = { ...keyOf(record), clientId: 'client-other' };
        expect(await repository.findBySnapshotId(foreign)).toBeNull();
        expect(
          await repository.listSeries({ ...seriesKeyOf(record), clientId: 'client-other' }),
        ).toHaveLength(0);
        expect(
          await repository.findLatest({ ...seriesKeyOf(record), clientId: 'client-other' }),
        ).toBeNull();
      });

      it('cannot be read under a different organizationId', async () => {
        const repository = createRepository();
        const record = makeRecord();
        await repository.append(record);

        const foreign = { ...keyOf(record), organizationId: 'org-other' };
        expect(await repository.findBySnapshotId(foreign)).toBeNull();
        expect(
          await repository.listSeries({ ...seriesKeyOf(record), organizationId: 'org-other' }),
        ).toHaveLength(0);
        expect(
          await repository.findLatest({ ...seriesKeyOf(record), organizationId: 'org-other' }),
        ).toBeNull();
      });

      it('keeps two clients holding the same bifId in separate series', async () => {
        const repository = createRepository();
        const mine = makeRecord();
        const theirs = makeRecord({ clientId: 'client-other', snapshotId: 'snap-theirs' });

        await repository.append(mine);
        await repository.append(theirs);

        expect(await repository.listSeries(seriesKeyOf(mine))).toHaveLength(1);
        expect(await repository.listSeries(seriesKeyOf(theirs))).toHaveLength(1);
      });
    });

    describe('append-only (ADR-0030, ADR-0031 D6/D8)', () => {
      it('rejects a re-used snapshotId within a series rather than overwriting', async () => {
        const repository = createRepository();
        const first = makeRecord({ capturedAt: '2026-07-15T09:30:00.000Z' });
        await repository.append(first);

        await expect(
          repository.append(makeRecord({ capturedAt: '2026-08-01T00:00:00.000Z' })),
        ).rejects.toThrow(/already exists/i);

        // The original survives untouched — the failed append changed nothing.
        const found = await repository.findBySnapshotId(keyOf(first));
        expect(found?.capturedAt).toBe('2026-07-15T09:30:00.000Z');
        expect(await repository.listSeries(seriesKeyOf(first))).toHaveLength(1);
      });

      it('exposes no update, delete, upsert or soft-delete operation', () => {
        const repository = createRepository();

        for (const forbidden of [
          'update',
          'updateMany',
          'upsert',
          'delete',
          'deleteMany',
          'softDelete',
          'save',
          'remove',
          'setCurrent',
          'markCurrent',
        ]) {
          expect(
            (repository as unknown as Record<string, unknown>)[forbidden],
            `${forbidden} must not exist on a snapshot repository`,
          ).toBeUndefined();
        }
      });

      it('carries no mutable current/isCurrent flag on a stored record', async () => {
        const repository = createRepository();
        const record = makeRecord();
        await repository.append(record);

        const found = await repository.findBySnapshotId(keyOf(record));
        for (const forbidden of ['current', 'isCurrent', 'updatedAt', 'version', 'deletedAt']) {
          expect(
            Object.prototype.hasOwnProperty.call(found, forbidden),
            `${forbidden} must not be part of a stored snapshot`,
          ).toBe(false);
        }
      });
    });

    describe('series ordering and derived latest (ADR-0031 D9)', () => {
      it('lists a series oldest first by capturedAt regardless of append order', async () => {
        const repository = createRepository();
        const context = sampleContext();

        await repository.append(
          makeRecord({ snapshotId: 'snap-b', capturedAt: '2026-07-20T00:00:00.000Z' }, context),
        );
        await repository.append(
          makeRecord({ snapshotId: 'snap-a', capturedAt: '2026-07-10T00:00:00.000Z' }, context),
        );
        await repository.append(
          makeRecord({ snapshotId: 'snap-c', capturedAt: '2026-07-30T00:00:00.000Z' }, context),
        );

        const series = await repository.listSeries({ ...SCOPE, bifId: context.bifId });
        expect(series.map((entry) => entry.snapshotId)).toEqual(['snap-a', 'snap-b', 'snap-c']);
      });

      it('breaks a capturedAt tie by snapshotId, so order is reproducible', async () => {
        const repository = createRepository();
        const context = sampleContext();
        const sameInstant = '2026-07-15T09:30:00.000Z';

        await repository.append(
          makeRecord({ snapshotId: 'snap-z', capturedAt: sameInstant }, context),
        );
        await repository.append(
          makeRecord({ snapshotId: 'snap-a', capturedAt: sameInstant }, context),
        );

        const series = await repository.listSeries({ ...SCOPE, bifId: context.bifId });
        expect(series.map((entry) => entry.snapshotId)).toEqual(['snap-a', 'snap-z']);
      });

      it('derives latest by query, from ordering alone and not from append order', async () => {
        const repository = createRepository();
        const context = sampleContext();

        await repository.append(
          makeRecord({ snapshotId: 'snap-new', capturedAt: '2026-07-30T00:00:00.000Z' }, context),
        );
        // Appended LAST, captured EARLIEST — insertion order must not win.
        await repository.append(
          makeRecord({ snapshotId: 'snap-old', capturedAt: '2026-01-01T00:00:00.000Z' }, context),
        );

        const latest = await repository.findLatest({ ...SCOPE, bifId: context.bifId });
        expect(latest?.snapshotId).toBe('snap-new');
      });

      it('returns an empty series and a null latest for a BIF with no snapshots', async () => {
        const repository = createRepository();

        expect(await repository.listSeries({ ...SCOPE, bifId: 'bif-unknown' })).toEqual([]);
        expect(await repository.findLatest({ ...SCOPE, bifId: 'bif-unknown' })).toBeNull();
      });
    });

    describe('scoringVersion is an attribute, never a key (ADR-0031 D4)', () => {
      it('round-trips scoringVersion on the stored context', async () => {
        const repository = createRepository();
        const context = sampleContext();
        expect(context.metadata.scoringVersion).toBe('1.0.0');

        await repository.append(makeRecord({}, context));

        const found = await repository.findBySnapshotId({
          ...SCOPE,
          bifId: context.bifId,
          snapshotId: 'snap-1',
        });
        expect(found?.snapshot.context.metadata.scoringVersion).toBe('1.0.0');
      });

      it('stores several snapshots of one BIF under the same scoringVersion', async () => {
        const repository = createRepository();
        const context = sampleContext();

        // Re-scoring twice under one version is normal; keying on the version
        // would have made the second append a conflict.
        await repository.append(
          makeRecord({ snapshotId: 'rescore-1', capturedAt: '2026-07-15T09:30:00.000Z' }, context),
        );
        await repository.append(
          makeRecord({ snapshotId: 'rescore-2', capturedAt: '2026-07-16T09:30:00.000Z' }, context),
        );

        const series = await repository.listSeries({ ...SCOPE, bifId: context.bifId });
        expect(series).toHaveLength(2);
        expect(
          series.every((entry) => entry.snapshot.context.metadata.scoringVersion === '1.0.0'),
        ).toBe(true);
      });
    });

    describe('identity and time are caller-supplied (ADR-0031 D10)', () => {
      it('stores the caller snapshotId verbatim and mints none of its own', async () => {
        const repository = createRepository();
        const record = makeRecord({ snapshotId: 'caller-chosen-id' });

        await repository.append(record);
        const series = await repository.listSeries(seriesKeyOf(record));

        expect(series.map((entry) => entry.snapshotId)).toEqual(['caller-chosen-id']);
      });

      it('stores the caller capturedAt verbatim and reads no clock', async () => {
        const repository = createRepository();
        const past = '2019-03-01T12:00:00.000Z';

        await repository.append(makeRecord({ capturedAt: past }));
        const found = await repository.findBySnapshotId(keyOf(makeRecord()));

        // A generated timestamp would be "now", never 2019.
        expect(found?.capturedAt).toBe(past);
      });

      it('rejects a record whose identity or capturedAt is malformed', async () => {
        const repository = createRepository();

        await expect(repository.append(makeRecord({ snapshotId: '' }))).rejects.toThrow();
        await expect(repository.append(makeRecord({ clientId: '' }))).rejects.toThrow();
        await expect(
          repository.append(makeRecord({ capturedAt: '2026-07-15T09:30:00Z' })),
        ).rejects.toThrow();
      });
    });

    describe('scope is never inferred from the payload (ADR-0031 D5)', () => {
      it('stores under the key scope even when it disagrees with the payload bifId', async () => {
        const repository = createRepository();
        const context = sampleContext();
        const record = makeRecord({ bifId: 'bif-from-the-key' }, context);

        expect(context.bifId).not.toBe('bif-from-the-key');

        await repository.append(record);

        // Reachable under the KEY's bifId...
        expect(await repository.findBySnapshotId(keyOf(record))).not.toBeNull();
        // ...and not under the payload's, which the adapter never consulted.
        expect(
          await repository.findBySnapshotId({
            ...SCOPE,
            bifId: context.bifId,
            snapshotId: 'snap-1',
          }),
        ).toBeNull();
      });

      it('has no client or organization in the payload to infer a scope from', () => {
        const context = sampleContext();

        expect(Object.prototype.hasOwnProperty.call(context, 'clientId')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(context, 'organizationId')).toBe(false);
      });
    });
  });
}
