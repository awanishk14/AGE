/**
 * A section that is present in the scored context but does not meet the
 * capability's support thresholds.
 *
 * This is a statement about the CONTEXT, never about the business. "Below the
 * confidence threshold" means the platform cannot rely on the section yet — it
 * does not mean the section's subject matter is weak (ADR-0026, Decision 4).
 */
export interface UnsupportedContextSection {
  readonly sectionType: string;
  readonly sectionName: string;
  readonly sectionConfidenceScore: number;
  readonly sectionCompletenessScore: number;
  /** Which threshold(s) the section fell short of, stated plainly. */
  readonly reason: string;
}

/** A canonical section absent from the BIF, restated as a limitation. */
export interface MissingContextSection {
  readonly sectionType: string;
  readonly sectionName: string;
  /**
   * Always phrased as unknown-not-absent. The section carries no information,
   * so nothing — good or bad — may be concluded from it.
   */
  readonly limitation: string;
}

/**
 * The support thresholds this assessment applied, published with every result.
 *
 * ADR-0026 Decision 3 permits thresholds to be implementation-defined initially,
 * provided they are deterministic and explainable. They are therefore fixed
 * arithmetic constants owned by THIS capability, and they are echoed into the
 * summary so any consumer can see exactly what "supported" meant for this run
 * rather than having to infer it.
 *
 * These are explicitly NOT a platform-wide threshold policy. Whether thresholds
 * should be shared across capabilities or owned per capability is an open
 * ADR-0026 follow-up and is not decided here.
 */
export interface BusinessContextSupportThresholds {
  readonly minSectionConfidenceScore: number;
  readonly minSectionCompletenessScore: number;
  readonly minRootConfidenceScoreForReady: number;
}

/**
 * BusinessContextAssessmentSummary — the full disposition of a scored BIF
 * context assessment.
 *
 * Deliberately NOT the shared `ProcessingSummary` generic: that contract models
 * accepted / rejected / duplicate dispositions for candidate items (ADR-0016),
 * and this assessment neither validates nor deduplicates candidates. Nothing is
 * rejected here; sections are supported, present-but-weak, or absent.
 */
export interface BusinessContextAssessmentSummary {
  /** Semver of the assessment logic, so pinned expectations stay meaningful. */
  readonly assessmentVersion: string;
  readonly bifId: string;
  /** BIF lifecycle state, carried through. This capability never promotes it. */
  readonly bifStatus: string;
  readonly contextVersion: string;
  /** 0–100, copied from the projection. Never recomputed, never restated away. */
  readonly bifConfidenceScore: number;
  /** 0–100, copied from the projection. Never recomputed. */
  readonly bifCompletenessScore: number;
  readonly presentSectionCount: number;
  readonly supportedSectionCount: number;
  readonly populatedFieldCount: number;
  readonly unsupportedSections: readonly UnsupportedContextSection[];
  readonly missingSections: readonly MissingContextSection[];
  /** What limits this assessment, stated as limits. */
  readonly limitations: readonly string[];
  /** Projection/scoring warnings carried through verbatim, never suppressed. */
  readonly carriedWarnings: readonly string[];
  /** Projection/scoring reasons carried through verbatim. */
  readonly carriedReasons: readonly string[];
  /** What would raise sufficiency — context to gather, not conclusions to draw. */
  readonly improvementHints: readonly string[];
  readonly thresholds: BusinessContextSupportThresholds;
}
