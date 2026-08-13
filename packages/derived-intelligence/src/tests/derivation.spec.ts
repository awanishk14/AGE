import type { ModelledSubjectDerivation } from '@age/observation-association';
import {
  type SourceObservationEnvelope,
  acceptSourceObservationEnvelope,
} from '@age/source-observation';
import { describe, expect, it } from 'vitest';

import {
  CONVERGENT_DIRECTION_RULE,
  NOT_A_MEASUREMENT,
  TWO_PRODUCERS_REQUIRED,
  deriveIntelligence,
} from '../derivation';

/** ⚠️ OBVIOUSLY FICTIONAL (ADR-0053 D3, ADR-0065 D1). */
const DERIVATION: ModelledSubjectDerivation = {
  bifId: 'bif-fictional-1',
  kinds: [
    {
      subjectKind: 'service',
      state: 'derived',
      subjects: [
        { subjectKind: 'service', label: 'Widget Polishing' },
        { subjectKind: 'service', label: 'Widget Repair' },
      ],
      readings: [],
    },
    { subjectKind: 'audience', state: 'captured-nothing-recorded', subjects: [], readings: [] },
    { subjectKind: 'geography', state: 'never-captured', subjects: [], readings: [] },
    { subjectKind: 'priority', state: 'never-captured', subjects: [], readings: [] },
    { subjectKind: 'constraint', state: 'never-captured', subjects: [], readings: [] },
  ],
  subjects: [
    { subjectKind: 'service', label: 'Widget Polishing' },
    { subjectKind: 'service', label: 'Widget Repair' },
  ],
};

const RAW = {
  subject: { kind: 'modelled', subjectKind: 'service', label: 'Widget Polishing' },
  claim: { direction: 'down', materiality: 'moderate' },
  period: {
    observedAt: '2026-07-31T00:00:00.000Z',
    windowStart: '2026-07-01T00:00:00.000Z',
    windowEnd: '2026-07-31T00:00:00.000Z',
  },
  provenance: {
    sourceSystem: 'example-visibility-system',
    sourceInstance: 'instance-fictional-1',
    sourceRecordId: 'record-fictional-1',
    organizationScope: 'org-fictional-1',
  },
  claimKind: 'raw-observation',
};

/** A SECOND, INDEPENDENT producer — the whole point of D7. */
const SECOND_PRODUCER = {
  ...RAW,
  provenance: {
    ...RAW.provenance,
    sourceSystem: 'example-conversation-system',
    sourceRecordId: 'record-fictional-2',
  },
  period: { ...RAW.period, observedAt: '2026-08-02T00:00:00.000Z' },
};

const envelopeOf = (raw: unknown): SourceObservationEnvelope => {
  const acceptance = acceptSourceObservationEnvelope(raw);
  if (acceptance.outcome !== 'accepted') throw new Error('fixture is not a valid envelope');
  return acceptance.envelope;
};

const derive = (raws: readonly unknown[]) => deriveIntelligence(DERIVATION, raws.map(envelopeOf));

describe('🛑 TWO PRODUCERS OR IT IS NOT A CONCLUSION', () => {
  it('concludes when two DIFFERENT source systems report the same direction', () => {
    const projection = derive([RAW, SECOND_PRODUCER]);

    expect(projection.unconcluded).toEqual([]);
    expect(projection.conclusions).toHaveLength(1);
    expect(projection.conclusions[0]).toMatchObject({
      rule: CONVERGENT_DIRECTION_RULE,
      subjectKind: 'service',
      subjectLabel: 'Widget Polishing',
      direction: 'down',
      producerCount: 2,
      limitation: NOT_A_MEASUREMENT,
    });
  });

  it('🛑 refuses to conclude from ONE producer, 🚫 even from many observations', () => {
    const projection = derive([
      RAW,
      { ...RAW, provenance: { ...RAW.provenance, sourceRecordId: 'record-fictional-9' } },
      { ...RAW, provenance: { ...RAW.provenance, sourceRecordId: 'record-fictional-8' } },
    ]);

    expect(projection.conclusions).toEqual([]);
    expect(projection.unconcluded).toHaveLength(1);
    expect(projection.unconcluded[0]).toMatchObject({
      subjectLabel: 'Widget Polishing',
      reason: 'single-producer',
      explanation: TWO_PRODUCERS_REQUIRED,
    });
    // 🛑 Three observations, ONE producer. 🚫 Repetition is not corroboration.
    expect(projection.unconcluded[0]?.contributors).toHaveLength(3);
  });

  it('🚫 counts source SYSTEMS, never instances of one system', () => {
    const projection = derive([
      RAW,
      {
        ...RAW,
        provenance: {
          ...RAW.provenance,
          sourceInstance: 'instance-fictional-2',
          sourceRecordId: 'record-fictional-7',
        },
      },
    ]);

    expect(projection.conclusions).toEqual([]);
    expect(projection.unconcluded[0]?.reason).toBe('single-producer');
  });
});

describe('🛑 AGE does not pick a winner', () => {
  it('reports contested directions as contested, 🚫 not as a conclusion', () => {
    const projection = derive([
      RAW,
      { ...SECOND_PRODUCER, claim: { direction: 'up', materiality: 'substantial' } },
    ]);

    expect(projection.conclusions).toEqual([]);
    expect(projection.unconcluded[0]).toMatchObject({
      reason: 'contested-directions',
      explanation: 'Producers disagree about the direction.',
    });
  });

  it('🚫 does not break the tie by recency or materiality', () => {
    const projection = derive([
      { ...RAW, claim: { direction: 'flat', materiality: 'slight' } },
      {
        ...SECOND_PRODUCER,
        claim: { direction: 'absent', materiality: 'substantial' },
        period: { ...RAW.period, observedAt: '2026-08-09T00:00:00.000Z' },
      },
    ]);

    expect(projection.conclusions).toEqual([]);
    expect(projection.unconcluded[0]?.contributors.map((each) => each.direction)).toEqual([
      'flat',
      'absent',
    ]);
  });

  it('🛑 `absent` is a direction AGE can conclude on — a source LOOKED', () => {
    const projection = derive([
      { ...RAW, claim: { direction: 'absent', materiality: 'moderate' } },
      { ...SECOND_PRODUCER, claim: { direction: 'absent', materiality: 'slight' } },
    ]);

    expect(projection.conclusions[0]?.direction).toBe('absent');
  });
});

describe('🛑 “no source reported” is NOT “a source found nothing”', () => {
  it('reports a modelled subject nobody observed as `no-observation-relayed`', () => {
    const projection = derive([RAW, SECOND_PRODUCER]);

    expect(projection.unobservedSubjects).toEqual([
      { subjectKind: 'service', subjectLabel: 'Widget Repair', state: 'no-observation-relayed' },
    ]);
  });

  it('🚫 keeps that apart from an `absent` claim, which IS a source that looked', () => {
    const projection = derive([
      { ...RAW, claim: { direction: 'absent', materiality: 'moderate' } },
      { ...SECOND_PRODUCER, claim: { direction: 'absent', materiality: 'moderate' } },
    ]);

    expect(projection.conclusions[0]?.subjectLabel).toBe('Widget Polishing');
    expect(projection.unobservedSubjects.map((each) => each.subjectLabel)).toEqual([
      'Widget Repair',
    ]);
  });

  it('🛑 carries the kinds AGE never captured, with WHICH kind of nothing', () => {
    expect(derive([]).unmodelledKinds).toEqual([
      { subjectKind: 'audience', state: 'captured-nothing-recorded' },
      { subjectKind: 'geography', state: 'never-captured' },
      { subjectKind: 'priority', state: 'never-captured' },
      { subjectKind: 'constraint', state: 'never-captured' },
    ]);
  });

  it('🚫 concludes nothing from nothing, and 🚫 reports no clean bill', () => {
    const projection = derive([]);

    expect(projection.conclusions).toEqual([]);
    expect(projection.unconcluded).toEqual([]);
    expect(projection.unrelated).toEqual([]);
    // 🚫 Every modelled subject is unobserved — 🚫 never "nothing to report".
    expect(projection.unobservedSubjects).toHaveLength(2);
  });
});

describe('🚫 an observation AGE cannot relate is carried, never discarded', () => {
  it('keeps it with its association and its provenance', () => {
    const projection = derive([
      { ...RAW, subject: { kind: 'modelled', subjectKind: 'geography', label: 'Atlantis' } },
    ]);

    expect(projection.conclusions).toEqual([]);
    expect(projection.unrelated).toHaveLength(1);
    expect(projection.unrelated[0]?.association.outcome).toMatchObject({
      kind: 'not-associated',
      subjectKindState: 'never-captured',
    });
    expect(projection.unrelated[0]?.contributor.sourceSystem).toBe('example-visibility-system');
  });

  it('🚫 an unmapped subject never becomes a conclusion', () => {
    const projection = derive([
      { ...RAW, subject: { kind: 'unmapped', topicLabel: 'Widget Whispering' } },
      { ...SECOND_PRODUCER, subject: { kind: 'unmapped', topicLabel: 'Widget Whispering' } },
    ]);

    expect(projection.conclusions).toEqual([]);
    expect(projection.unrelated).toHaveLength(2);
  });
});

describe('🛑 a conclusion is deterministic, and as old as its evidence', () => {
  it('takes `asOf` from the LATEST contributor, 🚫 never from a clock', () => {
    expect(derive([RAW, SECOND_PRODUCER]).conclusions[0]?.asOf).toBe('2026-08-02T00:00:00.000Z');
  });

  it('produces byte-identical output for identical input', () => {
    expect(JSON.stringify(derive([RAW, SECOND_PRODUCER]))).toBe(
      JSON.stringify(derive([RAW, SECOND_PRODUCER])),
    );
  });

  it('quotes every contributing observation, 🚫 summarising none away', () => {
    const contributors = derive([RAW, SECOND_PRODUCER]).conclusions[0]?.contributors ?? [];

    expect(contributors.map((each) => each.sourceSystem)).toEqual([
      'example-visibility-system',
      'example-conversation-system',
    ]);
    expect(contributors[0]).toMatchObject({
      sourceRecordId: 'record-fictional-1',
      windowStart: '2026-07-01T00:00:00.000Z',
      materiality: 'moderate',
    });
  });

  it('🚫 emits no score, status or completeness figure, and says it is not stored', () => {
    const serialised = JSON.stringify(derive([RAW, SECOND_PRODUCER]));

    for (const forbidden of ['completenessScore', 'confidenceScore', 'bifStatus', 'confirmed']) {
      expect(serialised).not.toContain(forbidden);
    }
    expect(derive([RAW, SECOND_PRODUCER]).persistence).toBe('computed-projection-not-stored');
  });

  it('🚫 has no clock, id or randomness in its source', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../derivation.ts', import.meta.url), 'utf8'),
    );
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    expect(code.length).toBeGreaterThan(1000);
    for (const banned of [
      'new Date(',
      'Date.now(',
      'Math.random(',
      'fetch(',
      'process.env',
      '@prisma/client',
      '@age/persistence',
      'randomUUID',
    ]) {
      expect(code, banned).not.toContain(banned);
    }
  });
});
