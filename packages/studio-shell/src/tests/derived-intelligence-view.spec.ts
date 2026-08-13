/**
 * 🛑 **WHAT THIS SUITE IS REALLY GUARDING** is the moment a screen turns "AGE
 * has not been told" into "AGE checked and it is fine". Every assertion below
 * is one of the four silences refusing to become a clean bill.
 */

import type { DerivedIntelligenceProjection } from '@age/derived-intelligence';
import { describe, expect, it } from 'vitest';

import {
  DERIVATION_NOTICE,
  NO_OBSERVATION_RELAYED_EXPLANATION,
  NOTHING_CONCLUDED_NOTICE,
  PERSISTENCE_NOTICE,
  presentDerivedIntelligence,
} from '../derived-intelligence-view';

/** ⚠️ OBVIOUSLY FICTIONAL (ADR-0053 D3, ADR-0065 D1). */
const CONTRIBUTOR = {
  sourceSystem: 'example-visibility-system',
  sourceInstance: 'instance-fictional-1',
  sourceRecordId: 'record-fictional-1',
  observedAt: '2026-07-31T00:00:00.000Z',
  windowStart: '2026-07-01T00:00:00.000Z',
  windowEnd: '2026-07-31T00:00:00.000Z',
  direction: 'down',
  materiality: 'moderate',
} as const;

const SECOND_CONTRIBUTOR = {
  ...CONTRIBUTOR,
  sourceSystem: 'example-conversation-system',
  sourceRecordId: 'record-fictional-2',
  observedAt: '2026-08-02T00:00:00.000Z',
} as const;

const EMPTY: DerivedIntelligenceProjection = {
  bifId: 'bif-fictional-1',
  conclusions: [],
  unconcluded: [],
  unobservedSubjects: [],
  unmodelledKinds: [],
  unrelated: [],
  persistence: 'computed-projection-not-stored',
};

const CONCLUDED: DerivedIntelligenceProjection = {
  ...EMPTY,
  conclusions: [
    {
      rule: 'convergent-direction',
      subjectKind: 'service',
      subjectLabel: 'Widget Polishing',
      direction: 'down',
      producerCount: 2,
      contributors: [CONTRIBUTOR, SECOND_CONTRIBUTOR],
      asOf: '2026-08-02T00:00:00.000Z',
      limitation:
        'AGE concludes that two independent source systems reported the same direction over ' +
        'this subject. It does not know by how much, and it has not verified either report.',
    },
  ],
};

describe('🛑 a conclusion is never shown without its contributors', () => {
  it('quotes every contributing observation, with its source system and period', () => {
    const view = presentDerivedIntelligence(CONCLUDED);

    expect(view.conclusions[0]?.contributors).toEqual([
      {
        sourceSystem: 'example-visibility-system',
        sourceInstance: 'instance-fictional-1',
        sourceRecordId: 'record-fictional-1',
        claim: 'down · moderate',
        observedAt: '2026-07-31T00:00:00.000Z',
        window: '2026-07-01T00:00:00.000Z → 2026-07-31T00:00:00.000Z',
      },
      {
        sourceSystem: 'example-conversation-system',
        sourceInstance: 'instance-fictional-1',
        sourceRecordId: 'record-fictional-2',
        claim: 'down · moderate',
        observedAt: '2026-08-02T00:00:00.000Z',
        window: '2026-07-01T00:00:00.000Z → 2026-07-31T00:00:00.000Z',
      },
    ]);
  });

  it('names the rule that authored it and carries its limitation', () => {
    const view = presentDerivedIntelligence(CONCLUDED);

    expect(view.conclusions[0]?.rule).toBe('convergent-direction');
    expect(view.conclusions[0]?.limitation).toContain('has not verified either report');
    expect(view.derivationNotice).toBe(DERIVATION_NOTICE);
    expect(view.persistenceNotice).toBe(PERSISTENCE_NOTICE);
  });

  it('🛑 dates the conclusion from its evidence, 🚫 never from now', () => {
    const view = presentDerivedIntelligence(CONCLUDED);

    expect(view.conclusions[0]?.asOf).toBe('2026-08-02T00:00:00.000Z');
  });

  it('🚫 states agreement, 🚫 not a magnitude and 🚫 not an implication', () => {
    const statement = presentDerivedIntelligence(CONCLUDED).conclusions[0]?.statement ?? '';

    expect(statement).toContain('2 independent source systems reported down');
    for (const forbidden of ['%', 'should', 'recommend', 'risk', 'urgent', 'because']) {
      expect(statement.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe('🛑 an empty result must never read as a clean bill', () => {
  it('labels a projection with no conclusions', () => {
    const view = presentDerivedIntelligence(EMPTY);

    expect(view.conclusions).toEqual([]);
    expect(view.nothingConcludedNotice).toBe(NOTHING_CONCLUDED_NOTICE);
    expect(view.nothingConcludedNotice).toContain('not "no issues found"');
  });

  it('🚫 omits that notice once something WAS concluded', () => {
    expect(presentDerivedIntelligence(CONCLUDED).nothingConcludedNotice).toBeUndefined();
  });
});

describe('🛑 the four silences stay four', () => {
  it('says single-producer with both reports still visible', () => {
    const view = presentDerivedIntelligence({
      ...EMPTY,
      unconcluded: [
        {
          subjectKind: 'service',
          subjectLabel: 'Widget Polishing',
          reason: 'single-producer',
          contributors: [CONTRIBUTOR],
          explanation:
            'A finding drawn from one source system is that source’s observation restated. AGE ' +
            'reports it as a single-producer observation, not as a conclusion.',
        },
      ],
    });

    expect(view.unconcluded[0]?.reason).toBe('single-producer');
    expect(view.unconcluded[0]?.explanation).toContain('not as a conclusion');
    expect(view.unconcluded[0]?.contributors).toHaveLength(1);
  });

  it('🛑 says a modelled subject is UNOBSERVED — 🚫 not unchanged, 🚫 not fine', () => {
    const view = presentDerivedIntelligence({
      ...EMPTY,
      unobservedSubjects: [
        {
          subjectKind: 'service',
          subjectLabel: 'Widget Repair',
          state: 'no-observation-relayed',
        },
      ],
    });

    expect(view.unobservedSubjects[0]?.explanation).toBe(NO_OBSERVATION_RELAYED_EXPLANATION);
    expect(view.unobservedSubjects[0]?.explanation).toContain('whether nobody looked');
  });

  it('🛑 keeps "never captured" and "captured, nothing recorded" APART', () => {
    const view = presentDerivedIntelligence({
      ...EMPTY,
      unmodelledKinds: [
        { subjectKind: 'geography', state: 'never-captured' },
        { subjectKind: 'audience', state: 'captured-nothing-recorded' },
      ],
    });

    const [never, captured] = view.unmodelledKinds;
    expect(never?.explanation).toContain('AGE has not looked');
    expect(captured?.explanation).toContain('what the business said');
    expect(never?.explanation).not.toBe(captured?.explanation);
  });

  it('🛑 carries an unrelated observation rather than dropping it', () => {
    const view = presentDerivedIntelligence({
      ...EMPTY,
      unrelated: [
        {
          association: {
            outcome: { kind: 'unmapped-subject', topicLabel: 'widget sentiment' },
            belief: 'not-believed',
            beliefReason:
              'AGE can see what this observation is about. That is not agreement that it is ' +
              'true: source arrival is never confirmation, no score moved, and no BIF field ' +
              'changed.',
            scoreImpact: 'none',
          },
          contributor: CONTRIBUTOR,
        },
      ],
    });

    expect(view.unrelated[0]?.sourceSystem).toBe('example-visibility-system');
    expect(view.unrelated[0]?.explanation).toContain('gap is in what AGE models');
  });
});

describe('🚫 the view decides nothing', () => {
  it('preserves the order the rule produced — 🚫 no re-ranking', () => {
    const view = presentDerivedIntelligence({
      ...EMPTY,
      unobservedSubjects: [
        { subjectKind: 'service', subjectLabel: 'Zeta Service', state: 'no-observation-relayed' },
        { subjectKind: 'service', subjectLabel: 'Alpha Service', state: 'no-observation-relayed' },
      ],
    });

    expect(view.unobservedSubjects.map((each) => each.subject)).toEqual([
      'Zeta Service',
      'Alpha Service',
    ]);
  });

  it('reads no clock and invents no field', () => {
    const source = presentDerivedIntelligence.toString();

    for (const banned of ['new Date(', 'Date.now(', 'Math.random(', 'fetch(']) {
      expect(source.includes(banned), `the view must not contain ${banned}`).toBe(false);
    }
  });
});
