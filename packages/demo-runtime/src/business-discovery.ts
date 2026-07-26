import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  businessDiscoveryProfileSchema,
  produceScoredBifContext,
  validateProfileAgainstQuestionnaire,
} from '@age/business-discovery-contracts';

import type { DemoScenarioMetadata } from './demo-scenario-metadata';

/**
 * Business Discovery — the upstream *intake* stage of the demo.
 *
 * Discovery captures and normalizes a business's context; it is NOT a
 * capability run and produces no decision objects, so it deliberately stays
 * outside the capability approval model (nothing here is ever "approved" or
 * "executed"). Pure and deterministic: it reads the in-repo sample fixture,
 * validates it, maps it, and returns compact counters. No I/O, no
 * persistence, no AI/LLM, no network — evidence source URLs are counted, never
 * fetched.
 *
 * MAPPING PATH (ADR-0038 / ADR-0039). This stage uses canonical **Path B**,
 * `produceScoredBifContext` — discovery profile → Draft BIF → confidence scores
 * → the neutral `ScoredBifContext` projection. It no longer calls the legacy
 * Path A mapper. Path B requires `organizationId`, `constructedAt` and
 * `changedBy`, which are supplied as an explicit `DemoScenarioMetadata`
 * argument rather than invented anywhere downstream (ADR-0038 D6, ADR-0039 D3).
 *
 * Nothing is promoted: the BIF stays `Draft`, and a score is reported, never
 * acted on.
 */

/**
 * Compact, print-ready summary of one Business Discovery intake run. Counters
 * and section types only — the full profile is intentionally not exposed,
 * matching the compact style of the existing capability reports.
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
  /**
   * Canonical BIF section types the mapping actually populated, in projection
   * order. Replaces the legacy Path A `mappedSectionKeys`, which reported eight
   * locally-invented grouping keys rather than canonical sections.
   */
  readonly presentSectionTypes: readonly string[];
  /**
   * Canonical BIF section types the discovery input could not populate. Reported
   * first-class as limitations — never filled in, never treated as evidence of
   * anything (ADR-0025).
   */
  readonly omittedSectionTypes: readonly string[];
  readonly evidenceReferenceCount: number;
  readonly assumptionCount: number;
  readonly goalCount: number;
  readonly offeringCount: number;
  readonly customerSegmentCount: number;
  readonly competitorCount: number;
}

/**
 * runBusinessDiscoveryIntake — run the read-only Business Discovery intake stage
 * against the in-repo sample profile and return a compact summary.
 *
 * Steps: load `SAMPLE_BUSINESS_DISCOVERY_PROFILE` → validate against
 * `businessDiscoveryProfileSchema` → validate against
 * `DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE` → map via `produceScoredBifContext`
 * using the caller-supplied scenario metadata. Inputs are never mutated and
 * results depend only on those static inputs (no wall-clock, no I/O), so the
 * output is fully deterministic. No strategy or execution planning is derived,
 * and the BIF status is never promoted.
 *
 * The metadata is a required parameter, not a module default: the three values
 * Path B needs must be visible at the call site (ADR-0039 D3).
 */
export function runBusinessDiscoveryIntake(
  scenario: DemoScenarioMetadata,
): BusinessDiscoveryIntakeSummary {
  const profile = SAMPLE_BUSINESS_DISCOVERY_PROFILE;

  const profileSchemaValid = businessDiscoveryProfileSchema.safeParse(profile).success;
  const validation = validateProfileAgainstQuestionnaire(
    profile,
    DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  );
  const { context } = produceScoredBifContext(profile, {
    organizationId: scenario.organizationId,
    constructedAt: scenario.constructedAt,
    changedBy: scenario.changedBy,
  });

  return {
    profileId: profile.id,
    businessName: profile.businessName,
    questionnaireId: validation.questionnaireId,
    questionnaireVersion: validation.questionnaireVersion,
    profileSchemaValid,
    questionnaireValid: validation.valid,
    missingRequiredCount: validation.missingRequiredQuestionIds.length,
    criticalGapCount: validation.criticalGaps.length,
    // `String(...)` keeps the BIF enum out of demo-runtime's own types.
    presentSectionTypes: context.sections.map((section) => String(section.type)),
    omittedSectionTypes: context.omittedSections.map((section) => String(section.type)),
    evidenceReferenceCount: profile.evidenceSources.length,
    assumptionCount: profile.assumptions.length,
    goalCount: profile.goals.length,
    offeringCount: profile.offerings.length,
    customerSegmentCount: profile.segments.length,
    competitorCount: profile.competitors.length,
  };
}
