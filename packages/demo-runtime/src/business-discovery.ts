import {
  BIF_COMPATIBLE_SECTION_KEYS,
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  businessDiscoveryProfileSchema,
  mapBusinessDiscoveryToBifContext,
  validateProfileAgainstQuestionnaire,
  type BifCompatibleBusinessContext,
  type BifCompatibleSectionKey,
} from '@age/business-discovery-contracts';

/**
 * Business Discovery — the upstream *intake* stage of the demo.
 *
 * Discovery captures and normalizes a business's context; it is NOT a
 * capability run and produces no decision objects, so it deliberately stays
 * outside the capability approval model (nothing here is ever "approved" or
 * "executed"). Pure and deterministic: it reads the in-repo sample fixture,
 * validates it, projects it, and returns compact counters. No I/O, no
 * persistence, no AI/LLM, no network — evidence source URLs are counted, never
 * fetched.
 */

/**
 * Compact, print-ready summary of one Business Discovery intake run. Counters
 * and keys only — the full profile is intentionally not exposed, matching the
 * compact style of the existing capability reports.
 */
export interface BusinessDiscoveryIntakeSummary {
  readonly profileId: string;
  readonly businessName: string;
  readonly questionnaireId: string;
  readonly questionnaireVersion: string;
  /** Profile parses against `businessDiscoveryProfileSchema`. */
  readonly profileSchemaValid: boolean;
  /** Profile satisfies every required question/section of the questionnaire. */
  readonly questionnaireValid: boolean;
  readonly missingRequiredCount: number;
  readonly criticalGapCount: number;
  /** BIF-compatible section keys the projection actually populated. */
  readonly mappedSectionKeys: readonly BifCompatibleSectionKey[];
  readonly evidenceReferenceCount: number;
  readonly assumptionCount: number;
  readonly goalCount: number;
  readonly offeringCount: number;
  readonly customerSegmentCount: number;
  readonly competitorCount: number;
}

/**
 * Fixed, curated predicate per BIF-compatible section key deciding whether the
 * projection populated that section. Closed set, declaration-ordered — so
 * `mappedSectionKeys` is deterministic.
 */
const SECTION_POPULATED: Readonly<
  Record<BifCompatibleSectionKey, (context: BifCompatibleBusinessContext) => boolean>
> = {
  [BIF_COMPATIBLE_SECTION_KEYS.organizationIdentity]: (c) =>
    c.organizationIdentity.name.trim().length > 0,
  [BIF_COMPATIBLE_SECTION_KEYS.productsServices]: (c) => c.offerings.length > 0,
  [BIF_COMPATIBLE_SECTION_KEYS.icpPersonas]: (c) => c.customerSegments.length > 0,
  [BIF_COMPATIBLE_SECTION_KEYS.marketCompetition]: (c) =>
    c.marketCompetition.competitors.length > 0 || c.marketCompetition.geographies.length > 0,
  [BIF_COMPATIBLE_SECTION_KEYS.brandSystem]: (c) =>
    (c.organizationIdentity.brandPositioning?.trim().length ?? 0) > 0,
  [BIF_COMPATIBLE_SECTION_KEYS.gtmSystem]: (c) => c.marketingChannels.length > 0,
  [BIF_COMPATIBLE_SECTION_KEYS.assets]: (c) => c.assets.length > 0,
  [BIF_COMPATIBLE_SECTION_KEYS.constraints]: (c) => c.constraints.length > 0,
};

/** Section keys populated by the projection, in a fixed declaration order. */
function collectMappedSectionKeys(
  context: BifCompatibleBusinessContext,
): readonly BifCompatibleSectionKey[] {
  return Object.values(BIF_COMPATIBLE_SECTION_KEYS).filter((key) =>
    SECTION_POPULATED[key](context),
  );
}

/**
 * runBusinessDiscoveryIntake — run the read-only Business Discovery intake stage
 * against the in-repo sample profile and return a compact summary.
 *
 * Steps: load `SAMPLE_BUSINESS_DISCOVERY_PROFILE` → validate against
 * `businessDiscoveryProfileSchema` → validate against
 * `DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE` → project via
 * `mapBusinessDiscoveryToBifContext`. Inputs are never mutated and results
 * depend only on those static inputs (no wall-clock, no I/O), so the output is
 * fully deterministic. No strategy, scoring, or execution planning is derived.
 */
export function runBusinessDiscoveryIntake(): BusinessDiscoveryIntakeSummary {
  const profile = SAMPLE_BUSINESS_DISCOVERY_PROFILE;

  const profileSchemaValid = businessDiscoveryProfileSchema.safeParse(profile).success;
  const validation = validateProfileAgainstQuestionnaire(
    profile,
    DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  );
  const context = mapBusinessDiscoveryToBifContext(profile);

  return {
    profileId: profile.id,
    businessName: profile.businessName,
    questionnaireId: validation.questionnaireId,
    questionnaireVersion: validation.questionnaireVersion,
    profileSchemaValid,
    questionnaireValid: validation.valid,
    missingRequiredCount: validation.missingRequiredQuestionIds.length,
    criticalGapCount: validation.criticalGaps.length,
    mappedSectionKeys: collectMappedSectionKeys(context),
    evidenceReferenceCount: context.evidenceSources.length,
    assumptionCount: context.assumptions.length,
    goalCount: context.goals.length,
    offeringCount: context.offerings.length,
    customerSegmentCount: context.customerSegments.length,
    competitorCount: context.marketCompetition.competitors.length,
  };
}
