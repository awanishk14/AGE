import type { ScoredBifSnapshotRecord } from '@age/business-discovery-contracts';

/**
 * What AGE actually stored, rendered as itself (ADR-0064).
 *
 * ⚠️ WHY THIS MODULE EXISTS. Before it, AGE held TWO readiness answers for one
 * business and named neither. The Intelligence screen assesses the operator's
 * **answer file** — a document on their disk that they can edit after the fact.
 * `age-capture assess` assesses the **immutable stored row** — what was captured
 * at one instant and can never change. They can disagree, and until this module
 * shipped no surface said they were different questions.
 *
 * 🛑 THE TWO ARE NEVER MERGED (ADR-0064 D3). Not averaged, not reconciled, not
 * diffed, and 🚫 neither is silently preferred when they disagree. AGE has no
 * basis for deciding which is right: the file may be a correction or it may be a
 * mistake, and nothing in the system knows which. 🚫 Never an arrow, never "out
 * of date", never a colour that codes one as worse.
 *
 * 🚫 NOTHING HERE IS A SECOND READER. This module is pure: it takes a record
 * that a caller already read through the ADR-0055 D2 façade and shapes it for a
 * screen. It opens nothing, connects to nothing and writes nothing.
 *
 * 🚫 NO AGGREGATE, NO RANKING, NO VERDICT (ADR-0064 D6). No band, no count, no
 * progress bar, no badge, no ordering by state.
 */

/** One section of the stored context, named rather than counted. */
export interface StoredSnapshotSectionView {
  readonly name: string;
  readonly type: string;
}

/**
 * A number the snapshot does NOT carry, and why.
 *
 * ⚠️ THIS IS NOT A ZERO AND IT IS NOT A BLANK. A `ScoredBifContext` is projected
 * solely from a `BusinessIntelligenceFramework`; the two discovery scores live on
 * the discovery profile and are structurally out of scope for that projection —
 * deliberately, so intake metrics cannot leak into capability-facing context.
 * 🚫 Printing `0`, an empty cell or nothing at all would each turn "AGE never
 * kept this" into "AGE kept this and it was empty".
 */
export interface StoredSnapshotAbsentScoreView {
  readonly label: string;
  readonly state: 'not-stored';
  readonly detail: string;
}

export interface StoredSnapshotView {
  /**
   * ⚠️ Carried on the view itself, never assumed by the component. A screen that
   * knew its own provenance by convention is a screen one refactor away from
   * showing the wrong one.
   */
  readonly provenance: string;
  readonly snapshotId: string;
  readonly bifId: string;
  /** The instant the capture claimed, verbatim. 🚫 Never reformatted into "2 days ago". */
  readonly capturedAt: string;
  readonly snapshotVersion: string;
  readonly contextVersion: string;
  readonly bifStatus: string;
  readonly bifConfidenceScore: number;
  readonly bifCompletenessScore: number;
  /** The two discovery scores, as absences with reasons. 🚫 Never numbers. */
  readonly notStored: readonly StoredSnapshotAbsentScoreView[];
  readonly presentSectionCount: number;
  readonly canonicalSectionCount: number;
  readonly sections: readonly StoredSnapshotSectionView[];
  readonly omittedSectionCount: number;
  /**
   * ⚠️ NAMED, NOT COUNTED (ADR-0026 D4). A missing section is a LIMITATION, and
   * a limitation you cannot name is indistinguishable from an absence of one.
   * 🚫 The heading says "omitted", never "missing data" and never "incomplete" —
   * absence is never a conclusion about the business.
   */
  readonly omittedSections: readonly StoredSnapshotSectionView[];
  /**
   * ⚠️ ADR-0064 D4, stated ON the surface rather than left to be inferred. The
   * screen shows the latest row in scope and cannot show any other: cross-
   * snapshot reading is ADR-0055 §5 item 1, recorded and NOT authorized.
   * 🚫 No "latest of N", no timeline, no "previous", no pagination affordance —
   * and 🛑 DO NOT SEED A ROW to make a list look populated.
   */
  readonly singularity: string;
}

/** The label the stored answer always travels under. 🚫 Never abbreviated to "readiness". */
export const STORED_SNAPSHOT_PROVENANCE =
  'The stored capture — an immutable row, written once and never edited';

/** The label the OTHER answer travels under, so the two can never be confused. */
export const ANSWER_FILE_PROVENANCE =
  'The current answer file — a document on your disk, editable at any time';

/**
 * 🛑 THE SENTENCE ADR-0064 D3 EXISTS FOR. Shown whenever both answers are on
 * screen, and 🚫 never softened into "these may differ slightly".
 */
export const TWO_ANSWERS_NOTICE: readonly string[] = [
  'These are two different questions, not two attempts at one.',
  'The stored capture reports what was true at the instant it was written. The answer file ' +
    'reports what you have written down since. AGE does not know which one you mean, and it ' +
    'does not decide.',
  'If they disagree, that disagreement is shown and left standing. Nothing here reconciles ' +
    'them, prefers one, or treats either as superseded.',
];

const SINGULARITY =
  'This is the latest snapshot stored in this scope. AGE cannot show you any other: reading ' +
  'across snapshots is not authorized, so there is no history here, no earlier row and no count ' +
  'of how many exist.';

const notStoredDetail = (metric: string) =>
  `${metric} is not kept in a snapshot. A snapshot carries the BIF projection only, and this ` +
  'number belongs to the discovery profile the BIF was built from. It is absent, not zero.';

export function buildStoredSnapshotView(record: ScoredBifSnapshotRecord): StoredSnapshotView {
  const context = record.snapshot.context;

  return {
    provenance: STORED_SNAPSHOT_PROVENANCE,
    snapshotId: record.snapshotId,
    bifId: record.bifId,
    capturedAt: record.capturedAt,
    snapshotVersion: record.snapshot.snapshotVersion,
    contextVersion: context.contextVersion,
    bifStatus: context.bifStatus,
    // 🚫 The four scores are never combined and never averaged. `bifConfidenceScore`
    // is not discovery confidence and must never be presented as though it were.
    bifConfidenceScore: context.bifConfidenceScore,
    bifCompletenessScore: context.bifCompletenessScore,
    notStored: [
      {
        label: 'discoveryConfidenceScore',
        state: 'not-stored',
        detail: notStoredDetail('Discovery confidence'),
      },
      {
        label: 'discoveryCompletenessScore',
        state: 'not-stored',
        detail: notStoredDetail('Discovery completeness'),
      },
    ],
    presentSectionCount: context.metadata.presentSectionCount,
    canonicalSectionCount: context.metadata.canonicalSectionCount,
    sections: context.sections.map((section) => ({ name: section.name, type: section.type })),
    omittedSectionCount: context.metadata.omittedSectionCount,
    omittedSections: context.omittedSections.map((omitted) => ({
      name: omitted.name,
      type: omitted.type,
    })),
    singularity: SINGULARITY,
  };
}
