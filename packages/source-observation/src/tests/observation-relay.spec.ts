import { describe, expect, it } from 'vitest';

import {
  RELAY_ADMISSIBILITY_NOT_ASSESSED,
  RELAY_DOES_NOT_RECORD,
  relaySourceObservation,
} from '../observation-relay';

/**
 * ⚠️ OBVIOUSLY FICTIONAL, and that is the guard (ADR-0053 D3, ADR-0065 D1). 🚫 Do
 * not "make the fixtures more realistic" — a real business name in a committed
 * test is client data whether or not the repository is private.
 */
const RELAYED = Object.freeze({
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
});

const relayed = (input: unknown) => {
  const outcome = relaySourceObservation(input);
  if (outcome.kind !== 'relayed') throw new Error(`expected a relay, got ${outcome.kind}`);
  return outcome;
};

describe('a relay carries one observation', () => {
  it('reads the envelope back exactly as sent — 🚫 nothing repaired', () => {
    expect(relayed(RELAYED).envelope).toEqual({
      subject: { kind: 'modelled', subjectKind: 'service', label: 'Widget Polishing' },
      claim: { direction: 'down', materiality: 'moderate' },
      period: RELAYED.period,
      provenance: RELAYED.provenance,
      claimKind: 'raw-observation',
    });
  });

  it('carries an unmapped subject without promoting it', () => {
    const outcome = relayed({
      ...RELAYED,
      subject: { kind: 'unmapped', topicLabel: 'something AGE does not model' },
    });

    expect(outcome.envelope.subject).toEqual({
      kind: 'unmapped',
      topicLabel: 'something AGE does not model',
    });
  });

  it('🚫 does not branch on which peer product sent it (ADR-0069 D6)', () => {
    const first = relayed(RELAYED);
    const second = relayed({
      ...RELAYED,
      provenance: { ...RELAYED.provenance, sourceSystem: 'a-system-age-has-never-heard-of' },
    });

    expect({ ...second, envelope: { ...second.envelope, provenance: first.envelope.provenance } }) //
      .toEqual(first);
  });
});

describe('🛑 relayed is NOT recorded', () => {
  it('says so explicitly, and 🚫 never by omitting the field', () => {
    const outcome = relayed(RELAYED);

    expect(outcome.recorded).toBe(false);
    expect(Object.hasOwn(outcome, 'recorded')).toBe(true);
    expect(outcome.recordedReason).toBe(RELAY_DOES_NOT_RECORD);
  });

  it('🚫 exposes no way to record — there is no append on the outcome', () => {
    const outcome: Record<string, unknown> = { ...relayed(RELAYED) };

    for (const forbidden of ['append', 'record', 'save', 'store', 'commit', 'persist', 'flush']) {
      expect(outcome[forbidden]).toBeUndefined();
    }
  });
});

describe('🛑 admissibility is NOT assessed here, and says which', () => {
  it('reports `not-assessed` with its reason', () => {
    const outcome = relayed(RELAYED);

    expect(outcome.admissibility).toEqual({
      state: 'not-assessed',
      reason: RELAY_ADMISSIBILITY_NOT_ASSESSED,
    });
  });

  it('🚫 never serialises to a falsy value a reader would take as a negative finding', () => {
    const { admissibility } = relayed(RELAYED);

    expect(admissibility.state).not.toBe('inadmissible');
    expect(admissibility.state).not.toBe('admissible');
    for (const falsy of [null, false, 0, '', 'none']) {
      expect(admissibility.state).not.toBe(falsy);
    }
  });

  it('🚫 is not decided by the subject being one AGE might not model', () => {
    const unmapped = relayed({
      ...RELAYED,
      subject: { kind: 'unmapped', topicLabel: 'unrelatable' },
    });

    // ⚠️ Identical state for both subject shapes: this surface has no business
    // context, so it cannot have looked, so it must not appear to have looked.
    expect(unmapped.admissibility).toEqual(relayed(RELAYED).admissibility);
  });
});

describe('a malformed observation is refused by position', () => {
  it.each([
    [{}, 'subject'],
    [{ ...RELAYED, subject: undefined }, 'subject'],
    [{ ...RELAYED, claim: { direction: 'sideways', materiality: 'moderate' } }, 'claim.direction'],
    [{ ...RELAYED, claimKind: 'a-kind-age-does-not-know' }, 'claimKind'],
    [
      { ...RELAYED, provenance: { ...RELAYED.provenance, sourceInstance: '   ' } },
      'provenance.sourceInstance',
    ],
    [
      {
        ...RELAYED,
        period: { ...RELAYED.period, windowStart: '2026-08-31T00:00:00.000Z' },
      },
      'period.windowStart',
    ],
  ])('names %#', (input, position) => {
    const outcome = relaySourceObservation(input);

    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' ? outcome.position : undefined).toBe(position);
  });

  it('🚫 a refusal quotes no value, no organisation and no client id', () => {
    const outcome = relaySourceObservation({
      ...RELAYED,
      claim: { direction: 'sideways', materiality: 'moderate' },
    });

    const serialised = JSON.stringify(outcome);
    expect(serialised).not.toContain('sideways');
    expect(serialised).not.toContain('org-fictional-1');
    expect(serialised).not.toContain('Widget Polishing');
  });

  it('refuses a non-object outright', () => {
    for (const input of [null, undefined, 'an observation', 42, []]) {
      expect(relaySourceObservation(input).kind).toBe('refused');
    }
  });
});

describe('🚫 there is no bulk arm', () => {
  it('refuses an array of well-formed observations rather than relaying them', () => {
    const outcome = relaySourceObservation([RELAYED, RELAYED]);

    expect(outcome).toEqual({ kind: 'refused', reason: 'not-an-object', position: 'envelope' });
  });
});
