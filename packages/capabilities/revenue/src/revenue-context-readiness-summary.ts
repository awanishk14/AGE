/**
 * Summary shapes for the Revenue capability's context readiness assessment
 * (ADR-0027, Decision 1; third adopter of the pattern).
 *
 * Every shape here describes the CONTEXT — what is present, what is too weak,
 * what is absent. None of them describes, names, ranks or hints at a revenue
 * plan: ADR-0027 Decision 1 forbids a readiness assessment from deriving
 * candidates of any kind, in items or in summary text.
 */

/** Support thresholds for this capability, published in every summary. */
export interface RevenueContextReadinessThresholds {
  readonly minSectionConfidenceScore: number;
  readonly minSectionCompletenessScore: number;
  readonly minRootConfidenceScoreForReady: number;
}

/** A section this capability needs that is present but cannot be relied on yet. */
export interface WeakRevenueContextSection {
  readonly sectionType: string;
  readonly sectionName: string;
  readonly sectionConfidenceScore: number;
  readonly sectionCompletenessScore: number;
  /** Stated about the captured context, never about the business. */
  readonly reason: string;
}

/** A section this capability needs that is absent from the BIF entirely. */
export interface AbsentRevenueContextSection {
  readonly sectionType: string;
  readonly sectionName: string;
  /** Absence is unknown — never a strength, never a weakness. */
  readonly limitation: string;
}

/** A section this capability needs whose context clears both thresholds. */
export interface SupportedRevenueContextSection {
  readonly sectionType: string;
  readonly sectionName: string;
  readonly sectionConfidenceScore: number;
  readonly sectionCompletenessScore: number;
}

/**
 * The whole disposition of a readiness assessment.
 *
 * Deliberately NOT `RevenueProcessingSummary`: nothing here is derived,
 * validated, deduplicated or scored as a revenue plan. This summary reports only
 * how far the captured context carries the capability.
 */
export interface RevenueContextReadinessSummary {
  readonly assessmentVersion: string;
  readonly bifId: string;
  /** Carried through unchanged — this capability never promotes a BIF. */
  readonly bifStatus: string;
  readonly contextVersion: string;
  readonly bifConfidenceScore: number;
  readonly bifCompletenessScore: number;
  /** The section types this capability needs, as declared by the capability. */
  readonly requiredSectionTypes: readonly string[];
  readonly supportedSections: readonly SupportedRevenueContextSection[];
  readonly weakSections: readonly WeakRevenueContextSection[];
  readonly absentSections: readonly AbsentRevenueContextSection[];
  readonly presentSectionCount: number;
  readonly populatedFieldCount: number;
  /** Every limitation, phrased about the context. */
  readonly limitations: readonly string[];
  /** Projection/scoring warnings, carried through unsuppressed. */
  readonly carriedWarnings: readonly string[];
  readonly carriedReasons: readonly string[];
  /** What context would raise readiness — never what to conclude or do. */
  readonly improvementHints: readonly string[];
  readonly thresholds: RevenueContextReadinessThresholds;
}
