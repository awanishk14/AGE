import { acceptSourceObservationEnvelope } from '@age/source-observation';
import { describe, expect, it } from 'vitest';

import {
  ASSOCIATION_IS_NOT_BELIEF,
  associateObservation,
  associateObservations,
} from '../association';
import type { ModelledSubjectDerivation } from '../context-subjects';

/** ⚠️ OBVIOUSLY FICTIONAL (ADR-0053 D3, ADR-0065 D1). */
const DERIVATION: ModelledSubjectDerivation = {
  bifId: 'bif-fictional-1',
  kinds: [
    {
      subjectKind: 'service',
      state: 'derived',
      subjects: [{ subjectKind: 'service', label: 'Widget Polishing' }],
      readings: [],
    },
    { subjectKind: 'audience', state: 'captured-nothing-recorded', subjects: [], readings: [] },
    { subjectKind: 'geography', state: 'never-captured', subjects: [], readings: [] },
    { subjectKind: 'priority', state: 'never-captured', subjects: [], readings: [] },
    { subjectKind: 'constraint', state: 'never-captured', subjects: [], readings: [] },
  ],
  subjects: [{ subjectKind: 'service', label: 'Widget Polishing' }],
};

const RAW = Object.freeze({
  subject: { kind: 'modelled', subjectKind: 'service', label: 'widget polishing' },
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
});

const envelopeOf = (raw: unknown) => {
  const acceptance = acceptSourceObservationEnvelope(raw);
  if (acceptance.outcome !== 'accepted') throw new Error('fixture is not a valid envelope');
  return acceptance.envelope;
};

const associate = (raw: unknown) => associateObservation(DERIVATION, envelopeOf(raw));

describe('an observation is related to what the business says', () => {
  it('resolves to AGE’s OWN label, 🚫 not the source’s spelling', () => {
    expect(associate(RAW).outcome).toEqual({
      kind: 'associated',
      subjectKind: 'service',
      resolvedLabel: 'Widget Polishing',
    });
  });

  it('carries an unmapped subject as unmapped, 🚫 never nudged to the nearest match', () => {
    expect(
      associate({ ...RAW, subject: { kind: 'unmapped', topicLabel: 'Widget Polishng' } }).outcome,
    ).toEqual({ kind: 'unmapped-subject', topicLabel: 'Widget Polishng' });
  });

  it('🚫 does not associate on a different subject KIND with the same label', () => {
    const outcome = associate({
      ...RAW,
      subject: { kind: 'modelled', subjectKind: 'audience', label: 'Widget Polishing' },
    }).outcome;

    expect(outcome.kind).toBe('not-associated');
  });
});

describe('🛑 RELATING IS NOT BELIEVING', () => {
  it('says so on EVERY arm, including a successful association', () => {
    for (const raw of [
      RAW,
      { ...RAW, subject: { kind: 'unmapped', topicLabel: 'anything' } },
      { ...RAW, subject: { kind: 'modelled', subjectKind: 'geography', label: 'Atlantis' } },
    ]) {
      const result = associate(raw);

      expect(result.belief).toBe('not-believed');
      expect(result.beliefReason).toBe(ASSOCIATION_IS_NOT_BELIEF);
      expect(result.scoreImpact).toBe('none');
    }
  });

  it('🚫 never emits a score, a status or a completeness figure', () => {
    const serialised = JSON.stringify(associate(RAW));

    for (const forbidden of [
      'completeness',
      'confidenceScore',
      'bifStatus',
      'confirmed',
      'verified',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('🚫 provenance alone changes nothing — a different source associates identically', () => {
    const other = associate({
      ...RAW,
      provenance: { ...RAW.provenance, sourceSystem: 'a-system-age-has-never-heard-of' },
    });

    expect(other).toEqual(associate(RAW));
  });

  it('🚫 the claim’s direction and materiality change nothing', () => {
    const louder = associate({ ...RAW, claim: { direction: 'up', materiality: 'substantial' } });

    expect(louder).toEqual(associate(RAW));
  });
});

describe('🛑 a refusal says WHICH kind of “no” it is', () => {
  it('🛑 `never-captured` — AGE has never looked', () => {
    const outcome = associate({
      ...RAW,
      subject: { kind: 'modelled', subjectKind: 'geography', label: 'Atlantis' },
    }).outcome;

    expect(outcome).toEqual({
      kind: 'not-associated',
      reason: 'unknown-subject',
      position: 'subject',
      subjectKindState: 'never-captured',
    });
  });

  it('`captured-nothing-recorded` — AGE looked and holds no such subject', () => {
    const outcome = associate({
      ...RAW,
      subject: { kind: 'modelled', subjectKind: 'audience', label: 'Regional Widget Owners' },
    }).outcome;

    expect(outcome.kind === 'not-associated' ? outcome.subjectKindState : undefined).toBe(
      'captured-nothing-recorded',
    );
  });

  it('`derived` — AGE models this kind, and 🚫 not this one', () => {
    const outcome = associate({
      ...RAW,
      subject: { kind: 'modelled', subjectKind: 'service', label: 'Widget Launching' },
    }).outcome;

    expect(outcome.kind === 'not-associated' ? outcome.subjectKindState : undefined).toBe(
      'derived',
    );
  });

  it('🚫 a refusal names no subject AGE does model', () => {
    const serialised = JSON.stringify(
      associate({
        ...RAW,
        subject: { kind: 'modelled', subjectKind: 'service', label: 'Widget Launching' },
      }),
    );

    expect(serialised).not.toContain('Widget Polishing');
    expect(serialised).not.toContain('bif-fictional-1');
  });
});

describe('🚫 many observations are related, never combined', () => {
  it('relates each independently and keeps them apart', () => {
    const results = associateObservations(DERIVATION, [
      envelopeOf(RAW),
      envelopeOf({
        ...RAW,
        provenance: { ...RAW.provenance, sourceSystem: 'example-conversation-system' },
      }),
      envelopeOf({
        ...RAW,
        subject: { kind: 'modelled', subjectKind: 'geography', label: 'Atlantis' },
      }),
    ]);

    expect(results).toHaveLength(3);
    expect(results.map((result) => result.outcome.kind)).toEqual([
      'associated',
      'associated',
      'not-associated',
    ]);
  });

  it('🚫 two observations about ONE subject stay two — nothing is merged or counted', () => {
    const results = associateObservations(DERIVATION, [envelopeOf(RAW), envelopeOf(RAW)]);
    // ⚠️ The OUTCOMES only: `beliefReason` is prose that says the word "agreement"
    // in order to deny it, and scanning it would fail the guard for being right.
    const serialised = JSON.stringify(results.map((result) => result.outcome));

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(results[1]);
    for (const forbidden of ['count', 'total', 'agreement', 'corroborat', 'consensus']) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('relates nothing when given nothing, 🚫 without inventing an empty finding', () => {
    expect(associateObservations(DERIVATION, [])).toEqual([]);
  });
});
