import {
  CapabilityOutput,
  CapabilitySufficiencyState,
  Capability,
  createCapabilitySufficiency,
} from '@age/capability-kit';
import type {
  CapabilityOutputItem,
  CapabilitySufficiency,
  CapabilitySufficiencyReasons,
  ClientContext,
} from '@age/capability-kit';
import type { ScoredBifContext, ScoredBifContextSection } from '@age/business-discovery-contracts';
import type {
  AbsentRevenueContextSection,
  RevenueContextReadinessThresholds,
  SupportedRevenueContextSection,
  WeakRevenueContextSection,
} from '../revenue-context-readiness-summary';
import type { RevenueContextReadinessResult } from '../revenue-context-readiness-result';

/**
 * assessRevenueContextReadiness — the Revenue Capability's read-only readiness
 * assessment over a scored BIF context (ADR-0027, Decision 1; third adopter).
 *
 * WHAT THIS DOES. Given the neutral `ScoredBifContext` projection, it reports one
 * thing: whether the captured context carries enough revenue signal — what is
 * sold, to whom, and how it goes to market — for this capability to do its work:
 * `ready` / `partial` / `insufficient` / `blocked`, always with reasons, plus an
 * honest account of what is weak and what is unknown.
 *
 * WHAT THIS DOES NOT DO — the load-bearing part.
 *  - **It derives no revenue plans.** No plan, opportunity, action or
 *    recommendation is produced, ranked, named or hinted at, in items or in
 *    summary text. `output.items` is ALWAYS empty, structurally: the result type
 *    carries the base `CapabilityOutputItem` precisely because there is no item
 *    this assessment could legitimately emit (ADR-0027 Decision 1).
 *  - **It is not a gate.** `RevenueCapability.run` neither calls this nor depends
 *    on it. The two paths are independent, so nothing silently starts requiring
 *    business context (ADR-0027 Decision 1).
 *  - It does not import `@age/bif` and never sees a `BusinessIntelligenceFramework`
 *    (ADR-0026 Decision 1; ADR-0019).
 *  - It does not recompute BIF or section scores — they are read, never derived.
 *  - It does not promote BIF status, create placeholder sections, or infer any
 *    missing value. Absence is reported as absence (ADR-0026 Decision 4).
 *  - It does not mutate the input; every array it emits is newly built.
 *  - It reads no clock, no randomness, no environment, no filesystem, no network,
 *    and makes no AI call. `producedAt` is supplied by the caller (Decision 2).
 *
 * DETERMINISM. Given the same `ClientContext`, `ScoredBifContext` and
 * `producedAt`, the returned result is byte-for-byte identical.
 */

/** Semver of this assessment's logic. Bump when the emitted shape or rules change. */
export const REVENUE_CONTEXT_READINESS_VERSION = '1.0.0';

/**
 * The BIF sections this capability needs before it could treat business context
 * as a grounded basis for revenue work: what is sold, who it is sold to, and how
 * it goes to market and is monetised.
 *
 * Deliberately a DIFFERENT set from Market Discovery's ('market_competition'
 * there, 'gtm_system' here): the third adopter tests whether the required-section
 * SHAPE generalises across capabilities, not whether the integers recur — see
 * `docs/reviews/ADR0027_CAPABILITY_CONTEXT_READINESS_CHECKPOINT.md` §4.
 *
 * Held as plain strings, so this capability never imports the BIF `SectionType`
 * enum. Absent sections are reported as unknown, never as a negative signal.
 */
export const REQUIRED_REVENUE_CONTEXT_SECTION_TYPES: readonly string[] = [
  'products_services',
  'icp_personas',
  'gtm_system',
];

/**
 * Support thresholds for THIS capability.
 *
 * ADR-0027 Decision 2 keeps sufficiency thresholds per-capability and published:
 * they are owned here, applied by plain comparison, and echoed into every summary
 * via `summary.thresholds`. They are deliberately NOT imported from another
 * capability and NOT promoted to a shared package — "enough context to assess
 * evidence quality", "enough context for market discovery" and "enough context to
 * ground a revenue plan" are different judgements, and a shared constant would
 * assert they are the same. The checkpoint (§4) records why the recurring
 * 50/50/70 triple is a superficial match, not evidence for consolidation.
 */
export const REVENUE_CONTEXT_READINESS_THRESHOLDS: RevenueContextReadinessThresholds = {
  /** A required section must be at least this confident to be relied on. */
  minSectionConfidenceScore: 50,
  /** ...and at least this populated, so one field of nine cannot read as solid. */
  minSectionCompletenessScore: 50,
  /** Root confidence required before the context can be called `ready`. */
  minRootConfidenceScoreForReady: 70,
};

/** The major version of `ScoredBifContext` this capability understands. */
const SUPPORTED_CONTEXT_MAJOR_VERSION = '1';

export interface AssessRevenueContextReadinessOptions {
  /**
   * When the assessment was produced. REQUIRED, not optional: this is a
   * deterministic capability flow, and ADR-0026 Decision 2 requires such flows to
   * pass `producedAt` explicitly rather than fall back to the legacy wall clock.
   */
  readonly producedAt: Date;
}

function isSupported(section: ScoredBifContextSection): boolean {
  return (
    section.confidenceScore >= REVENUE_CONTEXT_READINESS_THRESHOLDS.minSectionConfidenceScore &&
    section.completenessScore >= REVENUE_CONTEXT_READINESS_THRESHOLDS.minSectionCompletenessScore
  );
}

/** Why a present section fell short — stated about the context, not the business. */
function describeShortfall(section: ScoredBifContextSection): string {
  const shortfalls: string[] = [];
  if (section.confidenceScore < REVENUE_CONTEXT_READINESS_THRESHOLDS.minSectionConfidenceScore) {
    shortfalls.push(
      `confidence ${section.confidenceScore} is below the required ${REVENUE_CONTEXT_READINESS_THRESHOLDS.minSectionConfidenceScore}`,
    );
  }
  if (
    section.completenessScore < REVENUE_CONTEXT_READINESS_THRESHOLDS.minSectionCompletenessScore
  ) {
    shortfalls.push(
      `completeness ${section.completenessScore} is below the required ${REVENUE_CONTEXT_READINESS_THRESHOLDS.minSectionCompletenessScore}`,
    );
  }
  return `Context for '${section.name}' cannot be relied on yet: ${shortfalls.join(' and ')}. This describes the captured context only — it is not a finding about the business or its revenue.`;
}

/**
 * Build the blocked result for a context this capability cannot assess at all.
 * Nothing is produced: no readiness grade, no invented reasons.
 */
function blockedResult(
  context: ClientContext,
  scoredBifContext: ScoredBifContext,
  producedAt: Date,
  reason: string,
): RevenueContextReadinessResult {
  const sufficiency = createCapabilitySufficiency({
    state: CapabilitySufficiencyState.Blocked,
    reasons: [reason],
    warnings: [...(scoredBifContext.warnings ?? [])],
  });

  return {
    output: new CapabilityOutput<CapabilityOutputItem>({
      clientId: context.clientId,
      organizationId: context.organizationId,
      capability: Capability.Revenue,
      executionDomains: [],
      items: [],
      producedAt,
      sufficiency,
    }),
    summary: {
      assessmentVersion: REVENUE_CONTEXT_READINESS_VERSION,
      bifId: scoredBifContext.bifId,
      bifStatus: String(scoredBifContext.bifStatus),
      contextVersion: scoredBifContext.contextVersion,
      bifConfidenceScore: scoredBifContext.bifConfidenceScore,
      bifCompletenessScore: scoredBifContext.bifCompletenessScore,
      requiredSectionTypes: [...REQUIRED_REVENUE_CONTEXT_SECTION_TYPES],
      supportedSections: [],
      weakSections: [],
      absentSections: [],
      presentSectionCount: Array.isArray(scoredBifContext.sections)
        ? scoredBifContext.sections.length
        : 0,
      populatedFieldCount: scoredBifContext.metadata.populatedFieldCount,
      limitations: [reason],
      carriedWarnings: [...(scoredBifContext.warnings ?? [])],
      carriedReasons: [...(scoredBifContext.reasons ?? [])],
      improvementHints: [],
      thresholds: REVENUE_CONTEXT_READINESS_THRESHOLDS,
    },
  };
}

/**
 * Decide readiness by fixed arithmetic over the required sections only.
 *
 * `ready` requires every required section present, each clearing both thresholds,
 * and strong root confidence — deliberately hard to reach, because a capability
 * claiming it could ground revenue work on thin context is the failure this track
 * exists to prevent. `partial` means at least one required section can be relied
 * on. Otherwise the honest answer is `insufficient`, which is a SUCCESSFUL
 * outcome, not an error.
 */
function decideState(
  scoredBifContext: ScoredBifContext,
  supportedCount: number,
  absentCount: number,
): CapabilitySufficiencyState {
  const everyRequiredSectionSupported =
    absentCount === 0 && supportedCount === REQUIRED_REVENUE_CONTEXT_SECTION_TYPES.length;
  const rootConfident =
    scoredBifContext.bifConfidenceScore >=
    REVENUE_CONTEXT_READINESS_THRESHOLDS.minRootConfidenceScoreForReady;

  if (everyRequiredSectionSupported && rootConfident) {
    return CapabilitySufficiencyState.Ready;
  }
  return supportedCount > 0
    ? CapabilitySufficiencyState.Partial
    : CapabilitySufficiencyState.Insufficient;
}

/** Reasons explaining the state. Always at least one — never asserted, always derived. */
function buildReasons(
  state: CapabilitySufficiencyState,
  scoredBifContext: ScoredBifContext,
  supportedCount: number,
  absentCount: number,
): CapabilitySufficiencyReasons {
  const required = REQUIRED_REVENUE_CONTEXT_SECTION_TYPES.length;
  const head =
    state === CapabilitySufficiencyState.Ready
      ? `All ${required} BIF section(s) this capability requires are present and meet the support thresholds, and root BIF confidence ${scoredBifContext.bifConfidenceScore} meets the required ${REVENUE_CONTEXT_READINESS_THRESHOLDS.minRootConfidenceScoreForReady}.`
      : state === CapabilitySufficiencyState.Partial
        ? `${supportedCount} of the ${required} BIF section(s) this capability requires meet the support thresholds, so part of the revenue context can be relied on and the rest cannot.`
        : `None of the ${required} BIF section(s) this capability requires meet the support thresholds (confidence >= ${REVENUE_CONTEXT_READINESS_THRESHOLDS.minSectionConfidenceScore} and completeness >= ${REVENUE_CONTEXT_READINESS_THRESHOLDS.minSectionCompletenessScore}), so there is no reliable revenue context to work from.`;

  const rest: string[] = [
    `Root BIF confidence is ${scoredBifContext.bifConfidenceScore} and root completeness is ${scoredBifContext.bifCompletenessScore}, as computed by the scoring layer and carried through unchanged.`,
    `${absentCount} of the ${required} required section(s) are absent from this BIF and are therefore unknown; ${scoredBifContext.metadata.populatedFieldCount} field(s) are populated across ${scoredBifContext.sections.length} present section(s).`,
    `This assessment reports context readiness only. It derives no revenue plan, and no revenue plan may be inferred from it (ADR-0027 Decision 1).`,
  ];

  return [head, ...rest];
}

export function assessRevenueContextReadiness(
  context: ClientContext,
  scoredBifContext: ScoredBifContext,
  options: AssessRevenueContextReadinessOptions,
): RevenueContextReadinessResult {
  if (scoredBifContext === null || typeof scoredBifContext !== 'object') {
    throw new Error('assessRevenueContextReadiness requires a ScoredBifContext');
  }
  if (!(options?.producedAt instanceof Date)) {
    throw new Error(
      'assessRevenueContextReadiness requires a caller-supplied producedAt (ADR-0026 Decision 2); this flow never reads the wall clock',
    );
  }
  const { producedAt } = options;

  // A context whose shape this capability does not understand, or that carries no
  // populated field at all, is `blocked` rather than `insufficient`: there is
  // nothing to assess, so producing a graded readiness for it would be invention.
  if (!Array.isArray(scoredBifContext.sections)) {
    return blockedResult(
      context,
      scoredBifContext,
      producedAt,
      'ScoredBifContext.sections is not an array, so the context violates the capability input contract and cannot be assessed.',
    );
  }
  if (String(scoredBifContext.contextVersion).split('.')[0] !== SUPPORTED_CONTEXT_MAJOR_VERSION) {
    return blockedResult(
      context,
      scoredBifContext,
      producedAt,
      `ScoredBifContext version '${scoredBifContext.contextVersion}' is not supported by this capability, which understands major version ${SUPPORTED_CONTEXT_MAJOR_VERSION}.`,
    );
  }
  if (
    scoredBifContext.metadata.populatedFieldCount === 0 ||
    scoredBifContext.sections.length === 0
  ) {
    return blockedResult(
      context,
      scoredBifContext,
      producedAt,
      'The scored BIF context carries no populated section or field, so there is no revenue context to assess. Nothing is inferred from its absence.',
    );
  }

  // Only the sections this capability requires are judged. Sections outside that
  // set are neither counted for nor against readiness.
  const requiredPresent = scoredBifContext.sections.filter((section) =>
    REQUIRED_REVENUE_CONTEXT_SECTION_TYPES.includes(String(section.type)),
  );

  const supportedSections: SupportedRevenueContextSection[] = requiredPresent
    .filter(isSupported)
    .map((section) => ({
      sectionType: String(section.type),
      sectionName: section.name,
      sectionConfidenceScore: section.confidenceScore,
      sectionCompletenessScore: section.completenessScore,
    }));

  const weakSections: WeakRevenueContextSection[] = requiredPresent
    .filter((section) => !isSupported(section))
    .map((section) => ({
      sectionType: String(section.type),
      sectionName: section.name,
      sectionConfidenceScore: section.confidenceScore,
      sectionCompletenessScore: section.completenessScore,
      reason: describeShortfall(section),
    }));

  const absentSections: AbsentRevenueContextSection[] = scoredBifContext.omittedSections
    .filter((omitted) => REQUIRED_REVENUE_CONTEXT_SECTION_TYPES.includes(String(omitted.type)))
    .map((omitted) => ({
      sectionType: String(omitted.type),
      sectionName: omitted.name,
      limitation: `'${omitted.name}' is absent from this BIF, so it is unknown. Absence is a limitation of the captured context and must not be read as a strength or a weakness of the business or its revenue.`,
    }));

  const state = decideState(scoredBifContext, supportedSections.length, absentSections.length);

  const limitations: string[] = [
    ...weakSections.map((section) => section.reason),
    ...absentSections.map((section) => section.limitation),
  ];

  // What would raise readiness: context to gather, never conclusions to draw and
  // never a revenue plan to pursue.
  const improvementHints: string[] = [];
  if (weakSections.length > 0) {
    improvementHints.push(
      `Raising confidence or completeness on ${weakSections.map((section) => `'${section.sectionName}'`).join(', ')} — for example by citing independent sources for the fields already captured — would move those section(s) into supported context.`,
    );
  }
  if (absentSections.length > 0) {
    improvementHints.push(
      `Capturing ${absentSections.map((section) => `'${section.sectionName}'`).join(', ')} would remove the unknowns limiting this readiness assessment.`,
    );
  }

  const sufficiency: CapabilitySufficiency = createCapabilitySufficiency({
    state,
    reasons: buildReasons(state, scoredBifContext, supportedSections.length, absentSections.length),
    // Projection/scoring warnings are carried through, never suppressed or softened.
    warnings: [...scoredBifContext.warnings],
    contextQualityNotes: limitations,
  });

  return {
    output: new CapabilityOutput<CapabilityOutputItem>({
      clientId: context.clientId,
      organizationId: context.organizationId,
      capability: Capability.Revenue,
      executionDomains: [],
      // Always empty: a readiness assessment emits no revenue plan (ADR-0027 D1).
      items: [],
      producedAt,
      sufficiency,
    }),
    summary: {
      assessmentVersion: REVENUE_CONTEXT_READINESS_VERSION,
      bifId: scoredBifContext.bifId,
      // Carried through. This capability never promotes a BIF out of Draft.
      bifStatus: String(scoredBifContext.bifStatus),
      contextVersion: scoredBifContext.contextVersion,
      bifConfidenceScore: scoredBifContext.bifConfidenceScore,
      bifCompletenessScore: scoredBifContext.bifCompletenessScore,
      requiredSectionTypes: [...REQUIRED_REVENUE_CONTEXT_SECTION_TYPES],
      supportedSections,
      weakSections,
      absentSections,
      presentSectionCount: scoredBifContext.sections.length,
      populatedFieldCount: scoredBifContext.metadata.populatedFieldCount,
      limitations,
      carriedWarnings: [...scoredBifContext.warnings],
      carriedReasons: [...scoredBifContext.reasons],
      improvementHints,
      thresholds: REVENUE_CONTEXT_READINESS_THRESHOLDS,
    },
  };
}
