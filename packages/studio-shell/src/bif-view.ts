import { FieldConfidence } from '@age/bif';
import type {
  BifConfidenceScoringMetadata,
  BusinessDiscoveryBifMetadata,
  ScoredBifContext,
} from '@age/business-discovery-contracts';

import type { EpistemicState } from './epistemic-state';

/**
 * Presenting a produced BIF, decided here and rendered by `apps/studio`.
 *
 * ⚠️ WHAT THIS SCREEN IS, AND WHAT IT IS NOT. It shows a BIF the console
 * PRODUCED from the answer file it wrote — the pure Discovery→BIF chain, run
 * in memory. It is NOT a view of a stored snapshot: nothing in the console has
 * ever read the capture store (ADR-0055 D7 is undischarged), and 🚫 no row is
 * seeded to make this render.
 *
 * ⚠️ The two must never be collapsed. A produced BIF is what the answers say
 * today; a stored snapshot is what was recorded, when, by whom, and under what
 * scope. Showing the first and letting it read as the second would let an
 * operator believe AGE has a history it does not have. Every fact that would
 * come from the store is therefore reported `not-assessed` — 🚫 never zero,
 * never "never", never an empty list.
 *
 * 🚫 NOTHING HERE PERSISTS AND NOTHING HERE CAN. This package imports the pure
 * `produceScoredBifContext` side only; it has no import path to
 * `@age/business-discovery-capture` or `@age/persistence`, so `produceAndCapture`
 * is not merely unused, it is unreachable. ADR-0054 D6's five conditions are
 * untouched and ADR-0046 D7 is not repealed.
 *
 * 🚫 It also computes nothing of its own. Every score below is carried through
 * unchanged from the scoring layer — no rounding, no averaging, no "overall"
 * number invented to head a page. ADR-0027's rule that readiness states are not
 * comparable applies to sections here for the same reason.
 */

/** A field, as the screen shows it. */
export interface BifFieldView {
  /**
   * ⚠️ The field's own key, shown verbatim as its label. The projection carries
   * no human-readable label, and 🚫 one is NOT invented here — a prettified name
   * this layer made up would not be the name anything else in AGE uses, and the
   * operator could not match what they see to what the CLI prints.
   */
  readonly key: string;
  readonly type: string;
  /** Rendered for display only. 🚫 Never parsed back into a value. */
  readonly value: string;
  readonly state: EpistemicState;
  /** The confidence enum, carried through verbatim so the state is auditable. */
  readonly confidence: string;
  readonly source: string;
  readonly required: boolean;
}

export interface BifSectionView {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly confidenceScore: number;
  readonly completenessScore: number;
  readonly fields: readonly BifFieldView[];
}

/**
 * A section the BIF does not carry.
 *
 * ⚠️ Its state is `unknown`, NOT `not-assessed`: the answers WERE read and they
 * said nothing about it. That is a result. 🚫 It is never negative evidence
 * about the business (ADR-0026 D4) — an omitted section is a limitation of what
 * was captured, and the screen says so in those words.
 */
export interface BifOmittedSectionView {
  readonly name: string;
  readonly type: string;
  readonly state: 'unknown';
}

/** Something in the answers that no BIF field corresponds to. */
export interface BifUnmappedFieldView {
  readonly field: string;
  readonly reason: string;
}

/**
 * The four scores, kept apart on purpose.
 *
 * ⚠️ `discoveryCompletenessScore` measures how fully the INTERVIEW was
 * captured; `bifCompletenessScore` measures how much of the canonical BIF this
 * draft populates. 🚫 They are never interchangeable and 🚫 never combined into
 * a headline number — a thorough interview still yields a sparse BIF, because
 * discovery covers only part of the BIF surface, and averaging the two would
 * hide exactly that.
 */
export interface BifScoreSet {
  readonly discoveryCompletenessScore: number;
  readonly discoveryConfidenceScore: number;
  readonly bifCompletenessScore: number;
  readonly bifConfidenceScore: number;
}

export interface GeneratedBifView {
  readonly bifId: string;
  readonly bifStatus: string;
  readonly scores: BifScoreSet;
  /** 🚫 BIF completeness. Never the intake's — they are not interchangeable. */
  readonly completenessScore: number;
  readonly confidenceScore: number;
  readonly scoringVersion: string;
  readonly sections: readonly BifSectionView[];
  readonly omittedSections: readonly BifOmittedSectionView[];
  readonly unmappedFields: readonly BifUnmappedFieldView[];
  readonly presentSectionCount: number;
  readonly omittedSectionCount: number;
}

/**
 * A field's epistemic state.
 *
 * ⚠️ ONLY independently verified evidence is `known`. A business's own answer is
 * `unattributed` — it is a claim AGE recorded, not a fact AGE checked — and an
 * inferred value is `unattributed` too, for the stronger reason that nobody
 * asserted it at all. 🚫 Do not promote `USER_CONFIRMED` to `known` because the
 * screen looks empty: every field of a first discovery run is a claim, and the
 * screen looking sparse is the correct report of that.
 */
export function fieldStateOf(confidence: string): EpistemicState {
  return confidence === FieldConfidence.EVIDENCE_VERIFIED ? 'known' : 'unattributed';
}

/**
 * Render a field's value for display.
 *
 * 🚫 Never "—", "N/A" or an empty string standing in for a value: a field that
 * reached the BIF has a value, and a placeholder would be indistinguishable
 * from a field that did not.
 */
export function renderFieldValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((entry) => renderFieldValue(entry)).join(', ');
  return JSON.stringify(value);
}

/**
 * Turn the produce chain's output into what the screen shows.
 *
 * ⚠️ Both metadata objects are required parameters with no defaults. The mapper
 * reported the unmapped fields and the scorer reported the omissions; a view
 * that re-derived either from the context would give a second answer to a
 * question that was already answered, which is the precise failure
 * `produceScoredBifContext` was written to stop.
 */
export function presentGeneratedBif(
  context: ScoredBifContext,
  mappingMetadata: BusinessDiscoveryBifMetadata,
  scoringMetadata: BifConfidenceScoringMetadata,
): GeneratedBifView {
  return Object.freeze({
    bifId: context.bifId,
    bifStatus: String(context.bifStatus),
    scores: Object.freeze({
      discoveryCompletenessScore: mappingMetadata.discoveryCompletenessScore,
      discoveryConfidenceScore: mappingMetadata.discoveryConfidenceScore,
      bifCompletenessScore: context.bifCompletenessScore,
      bifConfidenceScore: context.bifConfidenceScore,
    }),
    completenessScore: context.bifCompletenessScore,
    confidenceScore: context.bifConfidenceScore,
    scoringVersion: scoringMetadata.scoringVersion,
    sections: context.sections.map((section) =>
      Object.freeze({
        id: section.id,
        name: section.name,
        type: String(section.type),
        confidenceScore: section.confidenceScore,
        completenessScore: section.completenessScore,
        fields: section.fields.map((field) =>
          Object.freeze({
            key: field.key,
            type: String(field.type),
            value: renderFieldValue(field.value),
            state: fieldStateOf(String(field.confidence)),
            confidence: String(field.confidence),
            source: String(field.source),
            required: field.required,
          }),
        ),
      }),
    ),
    omittedSections: context.omittedSections.map((section) =>
      Object.freeze({ name: section.name, type: String(section.type), state: 'unknown' as const }),
    ),
    unmappedFields: mappingMetadata.unmappedDiscoveryFields.map((entry) =>
      Object.freeze({ field: entry.field, reason: entry.reason }),
    ),
    presentSectionCount: context.sections.length,
    omittedSectionCount: context.omittedSections.length,
  });
}

/**
 * What the console can say about the STORED history of this business.
 *
 * ⚠️ Exactly one answer, and it is not a number: nothing has read the capture
 * store. 🚫 "0 snapshots", "Last captured: never" and an empty history table are
 * all the same error — an unlooked-at absence rendered as a measured zero. This
 * stays until ADR-0055 D7 is discharged by a real business passing through the
 * shipped CLI path.
 */
export interface StoredHistoryFacet {
  readonly label: string;
  readonly state: 'not-assessed';
  readonly detail: string;
}

export function storedHistoryFacets(): readonly StoredHistoryFacet[] {
  return Object.freeze([
    Object.freeze({
      label: 'Stored snapshots',
      state: 'not-assessed' as const,
      detail:
        'The console has never read the capture store. This is not "no snapshots" — it is that ' +
        'nothing has looked.',
    }),
    Object.freeze({
      label: 'Last captured',
      state: 'not-assessed' as const,
      detail:
        'Capturing a snapshot requires the operator’s own local database run through ' +
        'age-capture onboard. The console does not write to the capture store.',
    }),
  ]);
}
