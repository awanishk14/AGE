/**
 * Summary shapes for the Market Discovery capability's context readiness
 * assessment (ADR-0027, Decision 1).
 *
 * Every shape here describes the CONTEXT — what is present, what is too weak,
 * what is absent. None of them describes, names, ranks or hints at a market
 * opportunity: ADR-0027 Decision 1 forbids a readiness assessment from deriving
 * candidates of any kind, in items or in summary text.
 */

/** Support thresholds for this capability, published in every summary. */
export interface MarketContextReadinessThresholds {
  readonly minSectionConfidenceScore: number;
  readonly minSectionCompletenessScore: number;
  readonly minRootConfidenceScoreForReady: number;
}

/** A section this capability needs that is present but cannot be relied on yet. */
export interface WeakMarketContextSection {
  readonly sectionType: string;
  readonly sectionName: string;
  readonly sectionConfidenceScore: number;
  readonly sectionCompletenessScore: number;
  /** Stated about the captured context, never about the business. */
  readonly reason: string;
}

/** A section this capability needs that is absent from the BIF entirely. */
export interface AbsentMarketContextSection {
  readonly sectionType: string;
  readonly sectionName: string;
  /** Absence is unknown — never a strength, never a weakness. */
  readonly limitation: string;
}

/** A section this capability needs whose context clears both thresholds. */
export interface SupportedMarketContextSection {
  readonly sectionType: string;
  readonly sectionName: string;
  readonly sectionConfidenceScore: number;
  readonly sectionCompletenessScore: number;
}

/**
 * The whole disposition of a readiness assessment.
 *
 * Deliberately NOT `OpportunityProcessingSummary`: nothing here is derived,
 * validated, deduplicated or scored as an opportunity. This summary reports only
 * how far the captured context carries the capability.
 */
export interface MarketContextReadinessSummary {
  readonly assessmentVersion: string;
  readonly bifId: string;
  /** Carried through unchanged — this capability never promotes a BIF. */
  readonly bifStatus: string;
  readonly contextVersion: string;
  readonly bifConfidenceScore: number;
  readonly bifCompletenessScore: number;
  /** The section types this capability needs, as declared by the capability. */
  readonly requiredSectionTypes: readonly string[];
  readonly supportedSections: readonly SupportedMarketContextSection[];
  readonly weakSections: readonly WeakMarketContextSection[];
  readonly absentSections: readonly AbsentMarketContextSection[];
  readonly presentSectionCount: number;
  readonly populatedFieldCount: number;
  /** Every limitation, phrased about the context. */
  readonly limitations: readonly string[];
  /** Projection/scoring warnings, carried through unsuppressed. */
  readonly carriedWarnings: readonly string[];
  readonly carriedReasons: readonly string[];
  /** What context would raise readiness — never what to conclude or do. */
  readonly improvementHints: readonly string[];
  readonly thresholds: MarketContextReadinessThresholds;
}
