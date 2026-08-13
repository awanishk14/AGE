import { describe, expect, it } from 'vitest';

import { assessAdmissibility } from '../admissibility';
import type { SourceObservationEnvelope } from '../observation-envelope';
import type { ModelledSubject } from '../observation-subject';

/** ⚠️ Obviously fictional, deliberately (ADR-0053 D3). */
const KNOWN: readonly ModelledSubject[] = Object.freeze([
  { subjectKind: 'service', label: 'Widget Polishing' },
  { subjectKind: 'geography', label: 'Fictionalton' },
]);

function envelopeAbout(subject: SourceObservationEnvelope['subject']): SourceObservationEnvelope {
  return {
    subject,
    claim: { direction: 'down', materiality: 'moderate' },
    period: { observedAt: '2026-07-31', windowStart: '2026-07-01', windowEnd: '2026-07-31' },
    provenance: {
      sourceSystem: 'example-seo-system',
      sourceInstance: 'instance-fictional-1',
      sourceRecordId: 'record-fictional-1',
      organizationScope: 'org-fictional-1',
    },
    claimKind: 'raw-observation',
  };
}

describe('assessAdmissibility admits only subjects AGE already models', () => {
  it('admits a subject AGE models, and resolves to AGE OWN label', () => {
    const result = assessAdmissibility(
      envelopeAbout({ kind: 'modelled', subjectKind: 'service', label: '  widget polishing ' }),
      KNOWN,
    );

    expect(result).toEqual({
      outcome: 'admissible',
      subjectKind: 'service',
      resolvedLabel: 'Widget Polishing',
    });
  });

  it('refuses a subject AGE does not model — the 50,000-row problem', () => {
    const result = assessAdmissibility(
      envelopeAbout({
        kind: 'modelled',
        subjectKind: 'service',
        label: 'best widget polisher near me cheap',
      }),
      KNOWN,
    );

    expect(result).toEqual({
      outcome: 'inadmissible',
      reason: 'unknown-subject',
      position: 'subject',
    });
  });

  it('refuses a right-label / wrong-kind subject rather than coercing the kind', () => {
    const result = assessAdmissibility(
      envelopeAbout({ kind: 'modelled', subjectKind: 'audience', label: 'Widget Polishing' }),
      KNOWN,
    );

    expect(result.outcome).toBe('inadmissible');
  });

  it('refuses every modelled subject when AGE models nothing yet — the truthful answer', () => {
    const result = assessAdmissibility(
      envelopeAbout({ kind: 'modelled', subjectKind: 'service', label: 'Widget Polishing' }),
      [],
    );

    expect(result).toEqual({
      outcome: 'inadmissible',
      reason: 'unknown-subject',
      position: 'subject',
    });
  });

  it('admits an unmapped subject AS UNMAPPED, never promoted to the nearest known one', () => {
    const result = assessAdmissibility(
      envelopeAbout({ kind: 'unmapped', topicLabel: 'Widget Polishing Adjacent Thing' }),
      KNOWN,
    );

    expect(result).toEqual({
      outcome: 'admissible-unmapped',
      topicLabel: 'Widget Polishing Adjacent Thing',
    });
    expect(result).not.toHaveProperty('resolvedLabel');
  });

  it('does not tell a refused relayer WHICH subjects AGE models', () => {
    const result = assessAdmissibility(
      envelopeAbout({ kind: 'modelled', subjectKind: 'service', label: 'Unknown Thing' }),
      KNOWN,
    );

    const serialised = JSON.stringify(result);
    for (const known of KNOWN) {
      expect(serialised).not.toContain(known.label);
    }
  });

  it('AGE-INV-PROV-1: the sourceSystem cannot change the outcome', () => {
    const subject = {
      kind: 'modelled',
      subjectKind: 'service',
      label: 'Widget Polishing',
    } as const;

    const first = envelopeAbout(subject);
    const second: SourceObservationEnvelope = {
      ...first,
      provenance: { ...first.provenance, sourceSystem: 'example-ads-system' },
    };

    expect(assessAdmissibility(second, KNOWN)).toEqual(assessAdmissibility(first, KNOWN));
  });

  it('AGE-INV-PROV-1: the claimKind cannot change the outcome either', () => {
    const subject = {
      kind: 'modelled',
      subjectKind: 'service',
      label: 'Widget Polishing',
    } as const;

    const raw = envelopeAbout(subject);
    const derived: SourceObservationEnvelope = {
      ...raw,
      claimKind: 'source-derived-intelligence',
    };

    expect(assessAdmissibility(derived, KNOWN)).toEqual(assessAdmissibility(raw, KNOWN));
  });
});
