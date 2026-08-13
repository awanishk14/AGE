/**
 * Admissibility — the rule that keeps AGE from becoming a data warehouse
 * (ADR-0069 D4).
 *
 * 🛑 **A WELL-FORMED ENVELOPE IS NOT AN ADMISSIBLE ONE.** The envelope check
 * asks whether the statement is complete; this asks whether AGE can do anything
 * with it. They are separate on purpose: a source that sends a perfectly-shaped
 * observation about a subject AGE does not model must be told *that*, precisely,
 * rather than being told its JSON is wrong.
 *
 * 🛑 **ADMISSIBLE IS NOT BELIEVED** (ADR-0069 D5). Nothing this module returns
 * moves a BIF field, a score, a status or a completeness figure. **Source
 * arrival is never confirmation** — an admitted observation is a CANDIDATE, and
 * it stays one.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

import {
  type ModelledSubject,
  type ObservationSubjectKind,
  type SubjectBearingObservation,
  isSameModelledSubject,
} from './observation-subject';

export type AdmissibilityOutcome =
  | {
      /** ⚠️ Admitted AND resolved to a subject AGE really models. */
      readonly outcome: 'admissible';
      readonly subjectKind: ObservationSubjectKind;
      /** AGE's OWN label for the subject — 🚫 not the source's spelling of it. */
      readonly resolvedLabel: string;
    }
  | {
      /**
       * 🛑 Admitted **as unmapped**, and never quietly promoted. This is the one
       * case where AGE keeps something it cannot relate, because the fact that
       * it cannot relate it is itself the finding: AGE's model is incomplete.
       * 🚫 An unmapped observation must never be counted as coverage of any
       * modelled subject, and 🚫 must never feed a derivation as though it were.
       */
      readonly outcome: 'admissible-unmapped';
      readonly topicLabel: string;
    }
  | {
      readonly outcome: 'inadmissible';
      /**
       * ⚠️ `unknown-subject` is the honest answer both when AGE models nothing
       * yet and when AGE models other things. 🚫 It is NOT distinguished into
       * "no context yet" vs "not this one" here, because the difference is
       * visible only to a caller who already knows the business context — and
       * telling a refused relayer which of the two it is would answer a question
       * about data it has not been entitled to.
       */
      readonly reason: 'unknown-subject';
      readonly position: 'subject';
    };

/**
 * @param knownSubjects the subjects AGE really models for THIS organisation,
 *   supplied by the caller from the real business context.
 *   🚫 **NEVER DEFAULTED, NEVER INFERRED FROM THE ENVELOPE.** An empty list is
 *   legitimate and means every modelled subject is inadmissible — the truthful
 *   answer before an intake exists, 🚫 not a reason to relax the rule.
 */
export function assessAdmissibility(
  // ⚠️ WIDENED TO WHAT THIS FUNCTION ACTUALLY READS. It touches `subject` and
  // nothing else, so a stored row can be asked the same question by the same
  // code — 🚫 rather than by a second implementation, or by an envelope rebuilt
  // around the row with its `organizationScope` invented back.
  envelope: Readonly<SubjectBearingObservation>,
  knownSubjects: readonly Readonly<ModelledSubject>[],
): AdmissibilityOutcome {
  const { subject } = envelope;

  if (subject.kind === 'unmapped') {
    return { outcome: 'admissible-unmapped', topicLabel: subject.topicLabel };
  }

  const claimed: ModelledSubject = { subjectKind: subject.subjectKind, label: subject.label };
  const match = knownSubjects.find((known) => isSameModelledSubject(known, claimed));

  if (match === undefined) {
    return { outcome: 'inadmissible', reason: 'unknown-subject', position: 'subject' };
  }

  // ⚠️ AGE's own label wins, so that two sources spelling the same service
  // differently resolve to ONE subject. 🚫 The source's spelling is not stored
  // as a second name for it — that would be a second source of truth.
  return { outcome: 'admissible', subjectKind: match.subjectKind, resolvedLabel: match.label };
}
