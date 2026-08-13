/**
 * The row-shaped entry point — the projection over observations AGE has
 * ALREADY RECORDED (ADR-0069 D1/D2/D7).
 *
 * 🛑 **THE POINT OF THIS SUITE IS THAT THERE IS ONE RULE, NOT TWO.** The
 * operator's view reads rows; the relay's view reads envelopes. If D7, the
 * contested arm or `asOf` could differ between them, the screen an operator
 * trusts would be running a gentler rule than the one AGE published.
 */

import type { ModelledSubjectDerivation } from '@age/observation-association';
import {
  type SourceObservationEnvelope,
  type StoredSourceObservation,
  acceptSourceObservationEnvelope,
} from '@age/source-observation';
import { describe, expect, it } from 'vitest';

import {
  CONVERGENT_DIRECTION_RULE,
  TWO_PRODUCERS_REQUIRED,
  deriveIntelligence,
  deriveIntelligenceFromStoredObservations,
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

const ROW: StoredSourceObservation = {
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
  // ⚠️ Deliberately far from `observedAt`: an operator-mediated relay happens
  // days after the observation, and 🚫 `recordedAt` must never become `asOf`.
  recordedAt: '2026-08-09T00:00:00.000Z',
};

/** A SECOND, INDEPENDENT producer — the whole point of D7. */
const SECOND_PRODUCER: StoredSourceObservation = {
  ...ROW,
  observationId: 'observation-fictional-2',
  sourceSystem: 'example-conversation-system',
  sourceRecordId: 'record-fictional-2',
  period: { ...ROW.period, observedAt: '2026-08-02T00:00:00.000Z' },
  recordedAt: '2026-08-11T00:00:00.000Z',
};

const envelopeOf = (row: StoredSourceObservation): SourceObservationEnvelope => {
  const acceptance = acceptSourceObservationEnvelope({
    subject: row.subject,
    claim: row.claim,
    period: row.period,
    claimKind: row.claimKind,
    provenance: {
      sourceSystem: row.sourceSystem,
      sourceInstance: row.sourceInstance,
      sourceRecordId: row.sourceRecordId,
      // ⚠️ Supplied HERE, in a test, because the equivalence check needs an
      // envelope to compare against. 🚫 The production row-shaped path invents
      // no such field — that is precisely what it exists to avoid.
      organizationScope: row.organizationId,
    },
  });
  if (acceptance.outcome !== 'accepted') throw new Error('fixture is not a valid envelope');
  return acceptance.envelope;
};

describe('🛑 ONE RULE, TWO ENTRY POINTS', () => {
  it('produces byte-identical output to the envelope path for the same observations', () => {
    const rows = [ROW, SECOND_PRODUCER];

    expect(deriveIntelligenceFromStoredObservations(DERIVATION, rows)).toEqual(
      deriveIntelligence(DERIVATION, rows.map(envelopeOf)),
    );
  });

  it('holds the equivalence on the single-producer path too', () => {
    const rows = [ROW];

    expect(deriveIntelligenceFromStoredObservations(DERIVATION, rows)).toEqual(
      deriveIntelligence(DERIVATION, rows.map(envelopeOf)),
    );
  });
});

describe('🛑 TWO PRODUCERS OR IT IS NOT A CONCLUSION, over rows', () => {
  it('concludes when two DIFFERENT source systems report the same direction', () => {
    const projection = deriveIntelligenceFromStoredObservations(DERIVATION, [ROW, SECOND_PRODUCER]);

    expect(projection.unconcluded).toEqual([]);
    expect(projection.conclusions).toHaveLength(1);
    expect(projection.conclusions[0]?.rule).toBe(CONVERGENT_DIRECTION_RULE);
    expect(projection.conclusions[0]?.producerCount).toBe(2);
    expect(projection.conclusions[0]?.subjectLabel).toBe('Widget Polishing');
  });

  it('🚫 does NOT conclude from two rows relayed by ONE source system', () => {
    const sameSystemTwice: StoredSourceObservation = {
      ...ROW,
      observationId: 'observation-fictional-3',
      sourceRecordId: 'record-fictional-3',
      sourceInstance: 'instance-fictional-2',
    };

    const projection = deriveIntelligenceFromStoredObservations(DERIVATION, [ROW, sameSystemTwice]);

    expect(projection.conclusions).toEqual([]);
    expect(projection.unconcluded).toHaveLength(1);
    expect(projection.unconcluded[0]?.reason).toBe('single-producer');
    expect(projection.unconcluded[0]?.explanation).toBe(TWO_PRODUCERS_REQUIRED);
    // ⚠️ Both are still shown. A rule that hides the evidence for its own
    // refusal is one the operator cannot check.
    expect(projection.unconcluded[0]?.contributors).toHaveLength(2);
  });

  it('🚫 does NOT pick a winner when the two producers disagree', () => {
    const disagrees: StoredSourceObservation = {
      ...SECOND_PRODUCER,
      claim: { direction: 'up', materiality: 'moderate' },
    };

    const projection = deriveIntelligenceFromStoredObservations(DERIVATION, [ROW, disagrees]);

    expect(projection.conclusions).toEqual([]);
    expect(projection.unconcluded[0]?.reason).toBe('contested-directions');
  });
});

describe('⚠️ what the row path must not invent', () => {
  it('reads `asOf` from the observations — 🚫 never from `recordedAt` or a clock', () => {
    const projection = deriveIntelligenceFromStoredObservations(DERIVATION, [ROW, SECOND_PRODUCER]);

    expect(projection.conclusions[0]?.asOf).toBe('2026-08-02T00:00:00.000Z');
    expect(projection.conclusions[0]?.asOf).not.toBe(SECOND_PRODUCER.recordedAt);
  });

  it('quotes each contributor from its own row, defaulting nothing', () => {
    const projection = deriveIntelligenceFromStoredObservations(DERIVATION, [ROW, SECOND_PRODUCER]);

    expect(projection.conclusions[0]?.contributors).toEqual([
      {
        sourceSystem: 'example-visibility-system',
        sourceInstance: 'instance-fictional-1',
        sourceRecordId: 'record-fictional-1',
        observedAt: '2026-07-31T00:00:00.000Z',
        windowStart: '2026-07-01T00:00:00.000Z',
        windowEnd: '2026-07-31T00:00:00.000Z',
        direction: 'down',
        materiality: 'moderate',
      },
      {
        sourceSystem: 'example-conversation-system',
        sourceInstance: 'instance-fictional-1',
        sourceRecordId: 'record-fictional-2',
        observedAt: '2026-08-02T00:00:00.000Z',
        windowStart: '2026-07-01T00:00:00.000Z',
        windowEnd: '2026-07-31T00:00:00.000Z',
        direction: 'down',
        materiality: 'moderate',
      },
    ]);
  });

  it('🛑 says a modelled subject is UNOBSERVED, 🚫 not unchanged and 🚫 not fine', () => {
    const projection = deriveIntelligenceFromStoredObservations(DERIVATION, [ROW, SECOND_PRODUCER]);

    expect(projection.unobservedSubjects).toEqual([
      { subjectKind: 'service', subjectLabel: 'Widget Repair', state: 'no-observation-relayed' },
    ]);
  });

  it('🛑 carries an unmapped row as unrelated — 🚫 never nudged to a known subject', () => {
    const unmapped: StoredSourceObservation = {
      ...ROW,
      observationId: 'observation-fictional-4',
      subject: { kind: 'unmapped', topicLabel: 'widget sentiment' },
    };

    const projection = deriveIntelligenceFromStoredObservations(DERIVATION, [unmapped]);

    expect(projection.conclusions).toEqual([]);
    expect(projection.unrelated).toHaveLength(1);
    expect(projection.unrelated[0]?.association.outcome.kind).toBe('unmapped-subject');
    expect(projection.unrelated[0]?.association.belief).toBe('not-believed');
  });

  it('🚫 concludes nothing from an empty list, and says so as a projection', () => {
    const projection = deriveIntelligenceFromStoredObservations(DERIVATION, []);

    expect(projection.conclusions).toEqual([]);
    expect(projection.unconcluded).toEqual([]);
    expect(projection.unobservedSubjects).toHaveLength(2);
    expect(projection.persistence).toBe('computed-projection-not-stored');
  });

  it('🚫 does not read `organizationId` — scope is the caller’s to enforce', () => {
    const foreign: StoredSourceObservation = {
      ...SECOND_PRODUCER,
      organizationId: 'org-fictional-2',
    };

    // ⚠️ ASSERTED SO NOBODY LATER "FIXES" IT INTO A FILTER. This function is
    // deliberately not the place isolation is decided: a projection that
    // silently dropped a row would report a smaller world as the whole one.
    expect(deriveIntelligenceFromStoredObservations(DERIVATION, [ROW, foreign])).toEqual(
      deriveIntelligenceFromStoredObservations(DERIVATION, [ROW, SECOND_PRODUCER]),
    );
  });
});
