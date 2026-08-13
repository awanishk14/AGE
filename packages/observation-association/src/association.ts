import {
  type ObservationSubjectKind,
  type SourceObservationEnvelope,
  assessAdmissibility,
} from '@age/source-observation';

import type { ModelledSubjectDerivation, SubjectKindState } from './context-subjects';

/**
 * Association — relating what a source observed to what the business says
 * (ADR-0069 D4/D5, deliverable 4).
 *
 * 🛑 **RELATING IS NOT BELIEVING.** An association says AGE can see WHAT an
 * observation is about. It says nothing whatever about whether the observation
 * is TRUE. **Source arrival is never confirmation** (D5), so 🚫 nothing here
 * promotes a BIF status, moves a score, fills a field, adds evidence or counts
 * toward completeness — and 🚫 no future caller may add a parameter that lets it.
 *
 * 🚫 **AN ASSOCIATED OBSERVATION IS STILL A CANDIDATE.** The word a screen may
 * use is "relates to"; 🚫 the words it may not use are "confirms", "shows",
 * "proves" or "validates".
 *
 * 🛑 **AN ASSOCIATION IS NOT ENTITLEMENT AND NOT PROVENANCE.** It does not decide
 * who may read anything, and it never edits the observation's provenance —
 * **provenance alone never changes a score** (AGE-INV-PROV-1) and it does not
 * change an association either: two identical observations from two different
 * source systems associate identically.
 *
 * ⚠️ **THIS RUNS ON THE OPERATOR'S SIDE, 🚫 NEVER ON THE RELAY.** The relay holds
 * no business context and must not: a `not-associated` outcome carries WHY, and
 * why is a fact about the business's own BIF. 🚫 Do not return this to a peer
 * product — `relaySourceObservation` deliberately answers `not-assessed`.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/** ⚠️ The sentence every surface must be able to quote. 🚫 Do not soften it. */
export const ASSOCIATION_IS_NOT_BELIEF =
  'AGE can see what this observation is about. That is not agreement that it is true: source ' +
  'arrival is never confirmation, no score moved, and no BIF field changed.';

export type AssociationOutcome =
  | {
      /** ⚠️ Related to a subject AGE models. 🛑 Related, 🚫 NOT believed. */
      readonly kind: 'associated';
      readonly subjectKind: ObservationSubjectKind;
      /** AGE's OWN label — 🚫 never the source system's spelling of it. */
      readonly resolvedLabel: string;
    }
  | {
      /**
       * 🛑 Carried, and carried AS UNMAPPED. AGE's model does not contain this
       * subject, and that gap is itself the finding. 🚫 It is never nudged to the
       * nearest known subject, and 🚫 it never feeds a derivation as if mapped.
       */
      readonly kind: 'unmapped-subject';
      readonly topicLabel: string;
    }
  | {
      readonly kind: 'not-associated';
      readonly reason: 'unknown-subject';
      readonly position: 'subject';
      /**
       * 🛑 WHY, in the only terms that are honest:
       * - `never-captured` — AGE holds no subject of this kind because it never
       *   captured the section. **AGE HAS NEVER LOOKED.**
       * - `captured-nothing-recorded` — AGE captured the section and recorded no
       *   such subject.
       * - `derived` — AGE models subjects of this kind, and 🚫 not this one.
       *
       * 🚫 These three must never be flattened into "unknown subject" on a
       * screen: the first is a gap in AGE, the third is a disagreement with the
       * source, and the operator's next action differs completely.
       */
      readonly subjectKindState: SubjectKindState;
    };

export interface Association {
  readonly outcome: AssociationOutcome;
  /** 🛑 Always, on every arm, including `associated`. 🚫 Never conditional. */
  readonly belief: 'not-believed';
  readonly beliefReason: typeof ASSOCIATION_IS_NOT_BELIEF;
  /** 🛑 Stated, so no reader has to infer it from the absence of a number. */
  readonly scoreImpact: 'none';
}

const association = (outcome: AssociationOutcome): Association =>
  Object.freeze({
    outcome,
    belief: 'not-believed' as const,
    beliefReason: ASSOCIATION_IS_NOT_BELIEF,
    scoreImpact: 'none' as const,
  });

/**
 * Relates ONE observation to the business context.
 *
 * @param derivation the subjects AGE models, from `deriveModelledSubjects`.
 *   🚫 Never defaulted and 🚫 never built from the observation itself — an
 *   observation that supplied its own subject list would always associate.
 */
export function associateObservation(
  derivation: Readonly<ModelledSubjectDerivation>,
  envelope: Readonly<SourceObservationEnvelope>,
): Association {
  const admissibility = assessAdmissibility(envelope, derivation.subjects);

  if (admissibility.outcome === 'admissible') {
    return association({
      kind: 'associated',
      subjectKind: admissibility.subjectKind,
      resolvedLabel: admissibility.resolvedLabel,
    });
  }

  if (admissibility.outcome === 'admissible-unmapped') {
    return association({ kind: 'unmapped-subject', topicLabel: admissibility.topicLabel });
  }

  // ⚠️ The subject is `modelled` on every path that reaches here — the `unmapped`
  // arm returned above — so its kind is the one to explain the refusal with.
  const { subject } = envelope;
  const subjectKindState =
    subject.kind === 'modelled'
      ? (derivation.kinds.find((kind) => kind.subjectKind === subject.subjectKind)?.state ??
        'never-captured')
      : 'never-captured';

  return association({
    kind: 'not-associated',
    reason: 'unknown-subject',
    position: 'subject',
    subjectKindState,
  });
}

/**
 * Relates MANY observations, each independently.
 *
 * 🚫 **THEY ARE NOT COMBINED HERE.** Two observations about one subject stay two
 * observations with two provenances; 🚫 nothing is merged, averaged, deduplicated
 * or reconciled. Relating several sources is deliberately not the same act as
 * concluding from them.
 */
export function associateObservations(
  derivation: Readonly<ModelledSubjectDerivation>,
  envelopes: readonly Readonly<SourceObservationEnvelope>[],
): readonly Association[] {
  return envelopes.map((envelope) => associateObservation(derivation, envelope));
}
