import { SectionType } from '@age/bif';
import {
  discoveryFieldPathForBifField,
  fieldProvenanceEntriesFor,
  type ProfileFieldProvenance,
} from '@age/business-discovery-contracts';

import type { BifSectionView } from './bif-view';

/**
 * ADR-0066 D6, slice 5 — showing, per BIF field, where that field's value came
 * from.
 *
 * 🛑 **THE ONE SENTENCE ABOUT PROVENANCE AND SCORING** is
 * `PROVENANCE_NEVER_CHANGES_A_SCORE`, below. 🚫 It is not re-worded, and neither
 * *"a document can never raise a score"* nor *"a source that cannot be named is
 * not a source"* is ever said — both are refused BY NAME (ADR-0066 §0.3).
 *
 * 🚫 **THE TWO LABELS ARE NEVER MERGED.** A field whose value two questions
 * produced gets two entries, side by side, each naming its own origin — 🚫 never
 * one summarised label, never a diff, never "mostly confirmed" (ADR-0066 D5).
 * The same rule governs the two ANSWERS: this view describes the BIF **produced
 * from the answer file** and nothing else, so it never carries the stored
 * capture's label, and `bif-field-source-view.spec.ts` asserts that.
 *
 * 🚫 **IT CARRIES NO NUMBER.** No confidence, no count-as-assessment, no score.
 * The scoring layer never sees this module and this module never sees a score:
 * AGE-INV-PROV-1 holds by shape, and is asserted by test as well.
 *
 * ⚠️ **AN ABSENT ENTRY IS `not-recorded`** — a third value that is neither
 * `stated` nor `confirmed-from-source`. 🚫 It is never defaulted to
 * `STATED_ANSWER_PROVENANCE`, because "a human typed this" is a claim, and AGE
 * has no basis for it here.
 */

export const PROVENANCE_NEVER_CHANGES_A_SCORE =
  'Provenance alone never changes a score. It records how a fact entered AGE, and nothing more.';

/** The label this view's answers travel under. 🚫 Never the stored capture's. */
export const PRODUCED_FROM_ANSWER_FILE =
  'Produced from the current answer file — a document on your disk, editable at any time';

/**
 * Where one BIF field's value came from.
 *
 * ⚠️ A union with three arms, and the third is a real answer. 🚫 Do not collapse
 * `not-recorded` and `no-discovery-origin`: the first says AGE has no record of
 * how a mapped field was answered, the second says discovery does not feed that
 * field at all. Rendering them the same way would turn "AGE never looked" into
 * "AGE looked and found nothing".
 */
export type BifFieldOriginView =
  | { readonly kind: 'stated'; readonly questionId: string; readonly detail: string }
  | {
      readonly kind: 'confirmed-from-source';
      readonly questionId: string;
      readonly sourceId: string;
      readonly locator: string;
      readonly confirmedBy: string;
      readonly detail: string;
    }
  | { readonly kind: 'not-recorded'; readonly detail: string }
  | { readonly kind: 'no-discovery-origin'; readonly detail: string };

export interface BifFieldSourceView {
  readonly key: string;
  /** The discovery field behind it, or `undefined` when discovery feeds none. */
  readonly fieldPath: string | undefined;
  /** 🚫 Kept SEPARATE, never merged into one summarised label (ADR-0066 D5). */
  readonly origins: readonly BifFieldOriginView[];
}

export interface BifSectionSourceView {
  readonly id: string;
  readonly name: string;
  readonly fields: readonly BifFieldSourceView[];
}

const NOT_RECORDED_DETAIL =
  'AGE has no record of how this field was answered. That is not the same as it having been ' +
  'typed by a person — nothing recorded an origin, so nothing is claimed about one.';

const NO_DISCOVERY_ORIGIN_DETAIL =
  'Discovery does not supply this BIF field, so there is no intake answer behind it.';

/**
 * Join the produced BIF's sections to the provenance channel.
 *
 * ⚠️ **BOTH PARAMETERS ARE REQUIRED, WITH NO DEFAULT** (ADR-0049 D2). A channel
 * that defaulted to empty would render every field `not-recorded` while looking
 * exactly like a channel that was passed and happened to be empty.
 *
 * 🚫 It reads `sections` for keys only. No value, no confidence and no score is
 * copied out of them: this view must stay unable to restate a number.
 */
export function presentBifFieldSources(
  sections: readonly BifSectionView[],
  channel: ProfileFieldProvenance,
): readonly BifSectionSourceView[] {
  return Object.freeze(
    sections.map((section) =>
      Object.freeze({
        id: section.id,
        name: section.name,
        fields: Object.freeze(
          section.fields.map((field) => {
            const fieldPath = discoveryFieldPathForBifField(section.type as SectionType, field.key);

            if (fieldPath === undefined) {
              return Object.freeze({
                key: field.key,
                fieldPath: undefined,
                origins: Object.freeze([
                  { kind: 'no-discovery-origin' as const, detail: NO_DISCOVERY_ORIGIN_DETAIL },
                ]),
              });
            }

            const entries = fieldProvenanceEntriesFor(channel, fieldPath);
            if (entries.length === 0) {
              return Object.freeze({
                key: field.key,
                fieldPath,
                origins: Object.freeze([
                  { kind: 'not-recorded' as const, detail: NOT_RECORDED_DETAIL },
                ]),
              });
            }

            return Object.freeze({
              key: field.key,
              fieldPath,
              // 🚫 ONE ENTRY IN, ONE ENTRY OUT. Never reduced, never deduped by
              // kind, never summarised — two origins are two origins.
              origins: Object.freeze(entries.map((entry) => originViewOf(entry))),
            });
          }),
        ),
      }),
    ),
  );
}

function originViewOf(entry: {
  readonly questionId: string;
  readonly provenance:
    | { readonly kind: 'stated' }
    | {
        readonly kind: 'confirmed-from-source';
        readonly sourceId: string;
        readonly locator: string;
        readonly confirmedBy: string;
      };
}): BifFieldOriginView {
  if (entry.provenance.kind === 'stated') {
    return Object.freeze({
      kind: 'stated' as const,
      questionId: entry.questionId,
      detail: 'Stated by a person in the intake.',
    });
  }

  return Object.freeze({
    kind: 'confirmed-from-source' as const,
    questionId: entry.questionId,
    sourceId: entry.provenance.sourceId,
    locator: entry.provenance.locator,
    confirmedBy: entry.provenance.confirmedBy,
    detail:
      `Proposed from source "${entry.provenance.sourceId}" at ${entry.provenance.locator}, and ` +
      `accepted by ${entry.provenance.confirmedBy}.`,
  });
}
