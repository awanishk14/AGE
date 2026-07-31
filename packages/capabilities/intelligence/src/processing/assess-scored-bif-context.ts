import {
  CapabilityOutput,
  CapabilitySufficiencyState,
  ClientContext,
  Capability,
  createCapabilitySufficiency,
} from '@age/capability-kit';
import type { CapabilitySufficiency, CapabilitySufficiencyReasons } from '@age/capability-kit';
import type { ScoredBifContext, ScoredBifContextSection } from '@age/business-discovery-contracts';
import type {
  BusinessContextSupportItem,
  BusinessContextSupportedField,
} from '../business-context-support-item';
import type {
  BusinessContextSupportThresholds,
  MissingContextSection,
  UnsupportedContextSection,
} from '../business-context-assessment-summary';
import type { BusinessContextAssessmentResult } from '../business-context-assessment-result';

/**
 * assessScoredBifContext — the Intelligence Capability's read-only consumption of
 * a scored BIF context (ADR-0026, Decision 5).
 *
 * WHAT THIS DOES. Given the neutral `ScoredBifContext` projection, it reports
 * which sections carry context strong enough to rely on, which are present but
 * too weak, which are absent, and — as a first-class outcome — how far that
 * context carries the capability (`ready` / `partial` / `insufficient` /
 * `blocked`), always with reasons.
 *
 * WHAT THIS DOES NOT DO.
 *  - It does not import `@age/bif` and never sees a `BusinessIntelligenceFramework`.
 *    The capability package's dependency set contains `@age/capability-kit`,
 *    `@age/evidence-contracts` and `@age/business-discovery-contracts` only
 *    (ADR-0026 Decision 1; ADR-0010/0012).
 *  - It does not generate strategy, recommendations, plans or execution steps.
 *    Every emitted value is either copied from the projection or a count of it.
 *  - It does not recompute BIF or section scores — they are read, never derived.
 *  - It does not promote BIF status, create placeholder sections, or infer any
 *    missing value. Absence is reported as absence (ADR-0026 Decision 4).
 *  - It does not mutate the input. Nothing is written back through the
 *    projection, and every array it emits is newly built.
 *  - It reads no clock, no randomness, no environment, no filesystem, no network,
 *    and makes no AI call. `producedAt` is supplied by the caller (Decision 2).
 *
 * DETERMINISM. Given the same `ClientContext`, `ScoredBifContext` and
 * `producedAt`, the returned result is byte-for-byte identical, including item
 * ids (derived from `bifId` + section type) and every timestamp.
 */

/** Semver of the assessment logic. Bump when the emitted shape or rules change. */
export const BUSINESS_CONTEXT_ASSESSMENT_VERSION = '1.0.0';

/**
 * Support thresholds for THIS capability.
 *
 * ADR-0026 Decision 3 permits implementation-defined thresholds provided they are
 * deterministic and explainable, so these are fixed integers, applied by plain
 * comparison, and published in every summary via `summary.thresholds`.
 *
 * They are NOT a platform-wide threshold policy, and nothing here is shared with
 * or imposed on another capability. Whether sufficiency thresholds should
 * eventually be shared or stay per-capability is an open ADR-0026 follow-up and
 * is deliberately left undecided by this slice.
 */
export const BUSINESS_CONTEXT_SUPPORT_THRESHOLDS: BusinessContextSupportThresholds = {
  /** A section must be at least this confident to be relied on. */
  minSectionConfidenceScore: 50,
  /** ...and at least this populated, so one field of nine cannot read as solid. */
  minSectionCompletenessScore: 50,
  /** Root confidence required before the whole context can be called `ready`. */
  minRootConfidenceScoreForReady: 70,
};

/** The major version of `ScoredBifContext` this capability understands. */
const SUPPORTED_CONTEXT_MAJOR_VERSION = '1';

export interface AssessScoredBifContextOptions {
  /**
   * When the assessment was produced. REQUIRED, not optional: this is a
   * deterministic capability flow, and ADR-0026 Decision 2 requires such flows to
   * pass `producedAt` explicitly rather than fall back to the legacy wall clock.
   */
  readonly producedAt: Date;
}

function projectSupportedFields(
  section: ScoredBifContextSection,
): readonly BusinessContextSupportedField[] {
  return section.fields.map((field) => ({
    key: field.key,
    required: field.required,
    // Carried through as strings so the capability never imports the BIF enums.
    source: String(field.source),
    confidence: String(field.confidence),
  }));
}

function isSupported(section: ScoredBifContextSection): boolean {
  return (
    section.confidenceScore >= BUSINESS_CONTEXT_SUPPORT_THRESHOLDS.minSectionConfidenceScore &&
    section.completenessScore >= BUSINESS_CONTEXT_SUPPORT_THRESHOLDS.minSectionCompletenessScore
  );
}

/** Why a present section fell short — stated about the context, not the business. */
function describeShortfall(section: ScoredBifContextSection): string {
  const shortfalls: string[] = [];
  if (section.confidenceScore < BUSINESS_CONTEXT_SUPPORT_THRESHOLDS.minSectionConfidenceScore) {
    shortfalls.push(
      `confidence ${section.confidenceScore} is below the required ${BUSINESS_CONTEXT_SUPPORT_THRESHOLDS.minSectionConfidenceScore}`,
    );
  }
  if (section.completenessScore < BUSINESS_CONTEXT_SUPPORT_THRESHOLDS.minSectionCompletenessScore) {
    shortfalls.push(
      `completeness ${section.completenessScore} is below the required ${BUSINESS_CONTEXT_SUPPORT_THRESHOLDS.minSectionCompletenessScore}`,
    );
  }
  return `Context for '${section.name}' cannot be relied on yet: ${shortfalls.join(' and ')}. This describes the captured context only — it is not a finding about the business.`;
}

function toMissingSection(
  omitted: ScoredBifContext['omittedSections'][number],
): MissingContextSection {
  return {
    sectionType: String(omitted.type),
    sectionName: omitted.name,
    limitation: `'${omitted.name}' is absent from this BIF, so it is unknown. Absence is a limitation of the captured context and must not be read as a strength or a weakness.`,
  };
}

/**
 * Build the blocked result for a context this capability cannot assess at all.
 * Nothing is produced: no items, no supported sections, no invented reasons.
 */
function blockedResult(
  context: ClientContext,
  scoredBifContext: ScoredBifContext,
  producedAt: Date,
  reason: string,
): BusinessContextAssessmentResult {
  const sufficiency = createCapabilitySufficiency({
    state: CapabilitySufficiencyState.Blocked,
    reasons: [reason],
    warnings: [...scoredBifContext.warnings],
  });

  return {
    output: new CapabilityOutput<BusinessContextSupportItem>({
      clientId: context.clientId,
      organizationId: context.organizationId,
      capability: Capability.Intelligence,
      executionDomains: [],
      items: [],
      producedAt,
      sufficiency,
    }),
    summary: {
      assessmentVersion: BUSINESS_CONTEXT_ASSESSMENT_VERSION,
      bifId: scoredBifContext.bifId,
      bifStatus: String(scoredBifContext.bifStatus),
      contextVersion: scoredBifContext.contextVersion,
      bifConfidenceScore: scoredBifContext.bifConfidenceScore,
      bifCompletenessScore: scoredBifContext.bifCompletenessScore,
      presentSectionCount: scoredBifContext.sections.length,
      supportedSectionCount: 0,
      populatedFieldCount: scoredBifContext.metadata.populatedFieldCount,
      unsupportedSections: [],
      missingSections: scoredBifContext.omittedSections.map(toMissingSection),
      limitations: [reason],
      carriedWarnings: [...scoredBifContext.warnings],
      carriedReasons: [...scoredBifContext.reasons],
      improvementHints: [],
      thresholds: BUSINESS_CONTEXT_SUPPORT_THRESHOLDS,
    },
  };
}

/**
 * Decide the sufficiency state by fixed arithmetic over the context.
 *
 * `ready` requires strong root confidence, no absent canonical section, and every
 * present section meeting both thresholds — deliberately hard to reach, because a
 * capability claiming readiness on thin context is the failure this track exists
 * to prevent. `partial` means at least one section can be relied on. Otherwise
 * the honest answer is `insufficient`, which is a SUCCESSFUL outcome.
 */
function decideState(
  scoredBifContext: ScoredBifContext,
  supportedCount: number,
): CapabilitySufficiencyState {
  const everyPresentSectionSupported =
    scoredBifContext.sections.length > 0 && supportedCount === scoredBifContext.sections.length;
  const nothingMissing = scoredBifContext.omittedSections.length === 0;
  const rootConfident =
    scoredBifContext.bifConfidenceScore >=
    BUSINESS_CONTEXT_SUPPORT_THRESHOLDS.minRootConfidenceScoreForReady;

  if (everyPresentSectionSupported && nothingMissing && rootConfident) {
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
): CapabilitySufficiencyReasons {
  const head =
    state === CapabilitySufficiencyState.Ready
      ? `All ${scoredBifContext.sections.length} canonical BIF sections are present and meet the support thresholds, and root BIF confidence ${scoredBifContext.bifConfidenceScore} meets the required ${BUSINESS_CONTEXT_SUPPORT_THRESHOLDS.minRootConfidenceScoreForReady}.`
      : state === CapabilitySufficiencyState.Partial
        ? `${supportedCount} of ${scoredBifContext.sections.length} present BIF section(s) meet the support thresholds, so some context can be relied on and the rest cannot.`
        : `None of the ${scoredBifContext.sections.length} present BIF section(s) meet the support thresholds (confidence >= ${BUSINESS_CONTEXT_SUPPORT_THRESHOLDS.minSectionConfidenceScore} and completeness >= ${BUSINESS_CONTEXT_SUPPORT_THRESHOLDS.minSectionCompletenessScore}), so no reliable business context is available to assess.`;

  const rest: string[] = [
    `Root BIF confidence is ${scoredBifContext.bifConfidenceScore} and root completeness is ${scoredBifContext.bifCompletenessScore}, as computed by the scoring layer and carried through unchanged.`,
    `${scoredBifContext.metadata.populatedFieldCount} field(s) are populated across ${scoredBifContext.sections.length} present section(s); ${scoredBifContext.omittedSections.length} of ${scoredBifContext.metadata.canonicalSectionCount} canonical section(s) are absent and therefore unknown.`,
    // The sanctioned non-derivation notice. Market Discovery and Revenue each
    // emit their own ('It derives no market opportunity' / 'no revenue plan');
    // this is Intelligence's, and it is stated in the SAME position — last in
    // the reasons — so a reader comparing the three capabilities sees it in
    // the same place every time.
    //
    // ⚠️ It says what this capability DOES NOT DO. That is not redundant with
    // the forbidden-vocabulary scan: the scan proves nothing prohibited was
    // said, which is silence, and silence is what an over-reading reader fills
    // in. This is the affirmative statement a scan cannot produce.
    `This assessment reports context readiness only. It derives no business conclusion, and no conclusion about the business may be inferred from it (ADR-0027 Decision 1).`,
  ];

  return [head, ...rest];
}

export function assessScoredBifContext(
  context: ClientContext,
  scoredBifContext: ScoredBifContext,
  options: AssessScoredBifContextOptions,
): BusinessContextAssessmentResult {
  if (scoredBifContext === null || typeof scoredBifContext !== 'object') {
    throw new Error('assessScoredBifContext requires a ScoredBifContext');
  }
  if (!(options?.producedAt instanceof Date)) {
    throw new Error(
      'assessScoredBifContext requires a caller-supplied producedAt (ADR-0026 Decision 2); this flow never reads the wall clock',
    );
  }
  const { producedAt } = options;

  // A context whose shape this capability does not understand, or that carries no
  // populated field at all, is `blocked` rather than `insufficient`: there is
  // nothing to assess, so producing a graded assessment of it would be invention.
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
      'The scored BIF context carries no populated section or field, so there is no business context to assess. Nothing is inferred from its absence.',
    );
  }

  const supported = scoredBifContext.sections.filter(isSupported);
  const unsupported: UnsupportedContextSection[] = scoredBifContext.sections
    .filter((section) => !isSupported(section))
    .map((section) => ({
      sectionType: String(section.type),
      sectionName: section.name,
      sectionConfidenceScore: section.confidenceScore,
      sectionCompletenessScore: section.completenessScore,
      reason: describeShortfall(section),
    }));

  const items: BusinessContextSupportItem[] = supported.map((section) => ({
    // Deterministic id: same context and section always yield the same id.
    id: `business-context-support:${scoredBifContext.bifId}:${String(section.type)}`,
    capability: Capability.Intelligence,
    // Caller-supplied timestamp, used exactly — no clock read anywhere.
    createdAt: producedAt,
    sectionType: String(section.type),
    sectionName: section.name,
    sectionConfidenceScore: section.confidenceScore,
    sectionCompletenessScore: section.completenessScore,
    supportedFields: projectSupportedFields(section),
  }));

  const state = decideState(scoredBifContext, supported.length);
  const missingSections = scoredBifContext.omittedSections.map(toMissingSection);

  const limitations: string[] = [
    ...unsupported.map((section) => section.reason),
    ...missingSections.map((section) => section.limitation),
  ];

  // What would raise sufficiency: context to gather, never conclusions to draw.
  const improvementHints: string[] = [];
  if (unsupported.length > 0) {
    improvementHints.push(
      `Raising confidence or completeness on ${unsupported.map((section) => `'${section.sectionName}'`).join(', ')} — for example by citing independent sources for the fields already captured — would move those section(s) into supported context.`,
    );
  }
  if (missingSections.length > 0) {
    improvementHints.push(
      `Capturing ${missingSections.map((section) => `'${section.sectionName}'`).join(', ')} would remove the unknowns limiting this assessment.`,
    );
  }

  const sufficiency: CapabilitySufficiency = createCapabilitySufficiency({
    state,
    reasons: buildReasons(state, scoredBifContext, supported.length),
    // Projection/scoring warnings are carried through, never suppressed or softened.
    warnings: [...scoredBifContext.warnings],
    contextQualityNotes: limitations,
  });

  return {
    output: new CapabilityOutput<BusinessContextSupportItem>({
      clientId: context.clientId,
      organizationId: context.organizationId,
      capability: Capability.Intelligence,
      executionDomains: [],
      items,
      producedAt,
      sufficiency,
    }),
    summary: {
      assessmentVersion: BUSINESS_CONTEXT_ASSESSMENT_VERSION,
      bifId: scoredBifContext.bifId,
      // Carried through. This capability never promotes a BIF out of Draft.
      bifStatus: String(scoredBifContext.bifStatus),
      contextVersion: scoredBifContext.contextVersion,
      bifConfidenceScore: scoredBifContext.bifConfidenceScore,
      bifCompletenessScore: scoredBifContext.bifCompletenessScore,
      presentSectionCount: scoredBifContext.sections.length,
      supportedSectionCount: supported.length,
      populatedFieldCount: scoredBifContext.metadata.populatedFieldCount,
      unsupportedSections: unsupported,
      missingSections,
      limitations,
      carriedWarnings: [...scoredBifContext.warnings],
      carriedReasons: [...scoredBifContext.reasons],
      improvementHints,
      thresholds: BUSINESS_CONTEXT_SUPPORT_THRESHOLDS,
    },
  };
}
