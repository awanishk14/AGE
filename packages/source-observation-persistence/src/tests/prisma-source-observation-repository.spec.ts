import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  StoredObservationRefusedError,
  type StoredSourceObservation,
} from '@age/source-observation';
import { describe, expect, it } from 'vitest';

import { PrismaSourceObservationRepository } from '../prisma-source-observation-repository';
import type {
  SourceObservationDelegate,
  SourceObservationRow,
} from '../source-observation-delegate';
import { toSourceObservationRow } from '../source-observation-row';

/** ⚠️ OBVIOUSLY FICTIONAL, and that is the guard (ADR-0053 D3, ADR-0065 D1). */
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

const UNMAPPED: StoredSourceObservation = {
  ...OBSERVATION,
  observationId: 'observation-fictional-2',
  subject: { kind: 'unmapped', topicLabel: 'Widget Polishng' },
};

interface Recorded {
  readonly created: SourceObservationRow[];
  readonly queries: unknown[];
  readonly delegate: SourceObservationDelegate;
}

const fakeDelegate = (rows: readonly unknown[] = [], onCreate?: () => never): Recorded => {
  const created: SourceObservationRow[] = [];
  const queries: unknown[] = [];

  return {
    created,
    queries,
    delegate: {
      create: async (args) => {
        if (onCreate !== undefined) onCreate();
        created.push(args.data);
        return undefined;
      },
      findMany: async (args) => {
        queries.push(args);
        return [...rows];
      },
    },
  };
};

describe('an observation is appended, and 🚫 never rewritten', () => {
  it('writes the flat row the table holds', async () => {
    const recorded = fakeDelegate();
    await new PrismaSourceObservationRepository(recorded.delegate).append(OBSERVATION);

    expect(recorded.created).toEqual([
      {
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
      },
    ]);
  });

  it('🛑 an unmapped subject writes `null`, 🚫 never a nearest-match kind', async () => {
    const recorded = fakeDelegate();
    await new PrismaSourceObservationRepository(recorded.delegate).append(UNMAPPED);

    expect(recorded.created[0]?.subjectKind).toBe(null);
    expect(recorded.created[0]?.subjectDisposition).toBe('unmapped');
    expect(recorded.created[0]?.subjectLabel).toBe('Widget Polishng');
  });

  it('🛑 the row that is VALIDATED is the row that is WRITTEN', async () => {
    const recorded = fakeDelegate();
    // A blank required column is refused by the read rule, and because the
    // check runs over the built row the mapping cannot smuggle one past.
    await expect(
      new PrismaSourceObservationRepository(recorded.delegate).append({
        ...OBSERVATION,
        sourceInstance: '   ',
      }),
    ).rejects.toBeInstanceOf(StoredObservationRefusedError);

    expect(recorded.created).toEqual([]);
  });

  it('🚫 a re-used id is the DATABASE’s answer, 🚫 never a read-then-write check', async () => {
    const recorded = fakeDelegate([], () => {
      throw Object.assign(new Error('duplicate'), { code: 'P2002' });
    });
    const repository = new PrismaSourceObservationRepository(recorded.delegate);

    await expect(repository.append(OBSERVATION)).rejects.toThrow(/append-only/);
    // 🚫 Nothing was read before writing — a pre-check two concurrent relays
    // would both pass is exactly what this store must not have.
    expect(recorded.queries).toEqual([]);
  });

  it('🚫 an unrecognised driver failure is not swallowed', async () => {
    const recorded = fakeDelegate([], () => {
      throw new Error('the connection went away');
    });

    await expect(
      new PrismaSourceObservationRepository(recorded.delegate).append(OBSERVATION),
    ).rejects.toThrow('the connection went away');
  });
});

describe('reading is scoped, ordered by the WORLD, and re-validated', () => {
  it('queries by organization and by `observedAt`, 🚫 not by `recordedAt`', async () => {
    const recorded = fakeDelegate([toSourceObservationRow(OBSERVATION)]);
    await new PrismaSourceObservationRepository(recorded.delegate).listForOrganization(
      'org-fictional-1',
    );

    expect(recorded.queries).toEqual([
      {
        where: { organizationId: 'org-fictional-1' },
        orderBy: [{ observedAt: 'desc' }, { observationId: 'desc' }],
      },
    ]);
    expect(JSON.stringify(recorded.queries)).not.toContain('recordedAt');
    // 🚫 There is no client here, by shape (ADR-0062 D1).
    expect(JSON.stringify(recorded.queries)).not.toContain('clientId');
  });

  it('rebuilds both subject shapes without coercing either', async () => {
    const recorded = fakeDelegate([
      toSourceObservationRow(OBSERVATION),
      toSourceObservationRow(UNMAPPED),
    ]);
    const read = await new PrismaSourceObservationRepository(recorded.delegate).listForOrganization(
      'org-fictional-1',
    );

    expect(read).toEqual([OBSERVATION, UNMAPPED]);
  });

  it('🛑 ONE unreadable row refuses the WHOLE read — 🚫 never a shorter list', async () => {
    const rows = [
      toSourceObservationRow(OBSERVATION),
      { ...toSourceObservationRow(UNMAPPED), subjectLabel: '' },
    ];

    await expect(
      new PrismaSourceObservationRepository(fakeDelegate(rows).delegate).listForOrganization(
        'org-fictional-1',
      ),
    ).rejects.toBeInstanceOf(StoredObservationRefusedError);
  });

  it('🛑 an empty result is an EMPTY LIST, and the caller must say what it means', async () => {
    const read = await new PrismaSourceObservationRepository(
      fakeDelegate([]).delegate,
    ).listForOrganization('org-fictional-1');

    // ⚠️ The repository does not editorialise; it also 🚫 never invents a
    // "no observations" finding. Rendering "nobody looked" versus "a source
    // looked and found nothing" is the surface's obligation.
    expect(read).toEqual([]);
  });
});

describe('🚫 the store cannot rewrite or retract', () => {
  const sourceOf = (file: string): string =>
    readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

  it('🛑 neither the delegate nor the repository can express a mutation', () => {
    const delegate = sourceOf('source-observation-delegate.ts');
    const repository = sourceOf('prisma-source-observation-repository.ts');

    expect(delegate.length).toBeGreaterThan(400);
    expect(repository.length).toBeGreaterThan(400);

    for (const banned of [
      'update',
      'upsert',
      'delete',
      'findUnique',
      'deleteMany',
      'status',
      'verified',
      'confirmed',
      'clientId',
    ]) {
      expect(delegate, banned).not.toContain(banned);
      expect(repository, banned).not.toContain(banned);
    }
  });

  it('🚫 the adapter has no clock, no ids and no randomness', () => {
    const repository = sourceOf('prisma-source-observation-repository.ts');

    for (const banned of ['new Date(', 'Date.now(', 'Math.random(', 'randomUUID', 'process.env']) {
      expect(repository, banned).not.toContain(banned);
    }
  });
});
