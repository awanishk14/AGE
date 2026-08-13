/**
 * What an observation is ABOUT (ADR-0069 D4).
 *
 * 🛑 **AN OBSERVATION IS ADMISSIBLE ONLY IF IT NAMES A SUBJECT AGE ALREADY
 * MODELS**, and that single rule is the whole size limit. 🚫 There is no row
 * cap, no rate limit and no per-vendor policy, because none of those is needed:
 * a keyword row, a rank position, an ad id or a conversation names nothing AGE
 * models, so it is not expressible here at all. **The contract makes the good
 * behaviour the only expressible behaviour**, which is why it scales to twenty
 * integrations unchanged — the constraint is AGE's own semantic model, 🚫 not a
 * rule written per source system.
 *
 * ⚠️ The union below is the reason a peer product cannot dump its dataset into
 * AGE by accident. It has exactly two arms and 🚫 no `default`.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/**
 * The kinds of subject AGE models today.
 *
 * ⚠️ These are the categories BIF and the BKG ontology already carry. 🚫 Do not
 * add a kind here to make a source system's data fit — a kind exists because AGE
 * reasons about it, not because a vendor emits it.
 */
export type ObservationSubjectKind =
  'service' | 'audience' | 'geography' | 'priority' | 'constraint';

export const OBSERVATION_SUBJECT_KINDS: readonly ObservationSubjectKind[] = Object.freeze([
  'service',
  'audience',
  'geography',
  'priority',
  'constraint',
]);

/**
 * The subject of an observation.
 *
 * - `modelled` — the source claims this names something AGE models. ⚠️ It is a
 *   CLAIM, not a resolution: `assessAdmissibility` decides, against subjects the
 *   caller supplies from the real business context.
 * - `unmapped` — 🛑 the ONE deliberate case where a subject AGE does not model is
 *   still admitted, and it is admitted **labelled as unmapped**. This is how AGE
 *   learns its own model is incomplete. 🚫 It is NEVER silently coerced into the
 *   nearest known subject, and 🚫 an `unmapped` subject never participates in a
 *   derivation as though it were a known one.
 */
export type ObservationSubject =
  | {
      readonly kind: 'modelled';
      readonly subjectKind: ObservationSubjectKind;
      /** The business's own name for it — 🚫 never a vendor's internal id. */
      readonly label: string;
    }
  | {
      readonly kind: 'unmapped';
      /** The raw topic label, and nothing else. 🚫 No inferred subject kind. */
      readonly topicLabel: string;
    };

/**
 * A subject the caller has established that AGE really models, drawn from the
 * real business context.
 *
 * 🚫 This package NEVER builds this list itself and never defaults it. An empty
 * list is a legitimate state and means **every modelled subject is refused** —
 * which is the truthful answer before an intake exists, 🚫 not a reason to relax
 * the check.
 */
export interface ModelledSubject {
  readonly subjectKind: ObservationSubjectKind;
  readonly label: string;
}

/**
 * Subject matching is exact on kind, and case-insensitive plus
 * whitespace-trimmed on the label.
 *
 * ⚠️ That is the FULL extent of the leniency, deliberately. 🚫 No stemming, no
 * fuzzy match, no synonym table, no substring containment: each of those is an
 * inference, and an inference here would let a source system's wording decide
 * what AGE believes it models. `assessAdmissibility` refuses instead, and a
 * refusal is recoverable — a wrong match is not.
 */
export function subjectLabelKey(label: string): string {
  return label.trim().toLowerCase();
}

export function isSameModelledSubject(
  left: Readonly<ModelledSubject>,
  right: Readonly<ModelledSubject>,
): boolean {
  return (
    left.subjectKind === right.subjectKind &&
    subjectLabelKey(left.label) === subjectLabelKey(right.label)
  );
}
