import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  businessDiscoveryProfileSchema,
  validateProfileAgainstQuestionnaire,
} from '@age/business-discovery-contracts';
import type { BusinessDiscoveryProfile } from '@age/business-discovery-contracts';

import type { DemoScenarioMetadata } from './demo-scenario-metadata';
import { produceDemoScoredBifContext } from './scored-bif-context';

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
   * Intake capture completeness — a property of the *interview*, against the
   * discovery questionnaire. **Never** interchangeable with
   * `bifCompletenessScore` (ADR-0025). Read straight off the mapping metadata;
   * nothing here recomputes it.
   */
  readonly discoveryCompletenessScore: number;
  /**
   * How well-sourced the intake was. Discovery **input** confidence, and never
   * an input to BIF confidence. **Never** interchangeable with
   * `bifConfidenceScore`.
   */
  readonly discoveryConfidenceScore: number;
  /**
   * BIF **population** completeness: what proportion of the canonical BIF's
   * defined fields this draft actually populates. A property of the BIF.
   */
  readonly bifCompletenessScore: number;
  /** Trust in the produced business intelligence, from the scoring layer. */
  readonly bifConfidenceScore: number;
  /**
   * Always `Draft` here. Surfaced so a reader can see the status was not
   * promoted, rather than having to take it on trust — this stage never
   * promotes a BIF.
   */
  readonly bifStatus: string;
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
 * against a **caller-supplied** discovery profile and return a compact summary.
 *
 * Steps: take the caller's profile → validate against
 * `businessDiscoveryProfileSchema` → validate against
 * `DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE` → map via `produceScoredBifContext`
 * using the caller-supplied scenario metadata. Inputs are never mutated and
 * results depend only on those static inputs (no wall-clock, no I/O), so the
 * output is fully deterministic. No strategy or execution planning is derived,
 * and the BIF status is never promoted.
 *
 * BOTH parameters are required and neither has a default (ADR-0039 D3,
 * ADR-0049 D2): the three values Path B needs, and the business being analysed,
 * must be visible at the call site rather than read from module scope.
 *
 * ⚠️ Until ADR-0049 this function opened with `const profile =
 * SAMPLE_BUSINESS_DISCOVERY_PROFILE`. That single line made the whole pipeline —
 * intake, scoring and the ADR-0047/0048 readiness stage downstream of it — a
 * function of one constant, and therefore unfalsifiable: with a fixed input,
 * "derived from the profile" and "hard-coded" are observationally identical.
 * **Do not reintroduce a default.**
 *
 * ⚠️ A sparse or partially-answered profile is a valid input and produces a
 * valid summary. Incompleteness is reported through the counters and the omitted
 * section types — it is a limitation, never an error and never negative
 * evidence (ADR-0026 D4). This function throws for no profile shape the schema
 * accepts.
 */
export function runBusinessDiscoveryIntake(
  profile: BusinessDiscoveryProfile,
  scenario: DemoScenarioMetadata,
): BusinessDiscoveryIntakeSummary {
  const profileSchemaValid = businessDiscoveryProfileSchema.safeParse(profile).success;
  const validation = validateProfileAgainstQuestionnaire(
    profile,
    DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  );
  // Produced through the shared demo producer (ADR-0047 D2), so the three
  // scenario values canonical Path B requires are assembled in exactly one
  // place. This summary deliberately does NOT grow a `context` field: it is the
  // four-score contract projected field-by-field into a published API DTO, and
  // widening it would drag the readiness slice into the API layer.
  const { context, mappingMetadata } = produceDemoScoredBifContext(profile, scenario);

  return {
    profileId: profile.id,
    businessName: profile.businessName,
    questionnaireId: validation.questionnaireId,
    questionnaireVersion: validation.questionnaireVersion,
    profileSchemaValid,
    questionnaireValid: validation.valid,
    missingRequiredCount: validation.missingRequiredQuestionIds.length,
    criticalGapCount: validation.criticalGaps.length,
    // All four scores are READ, never derived here. The two pairs deliberately
    // sit side by side so the gap between them is visible rather than
    // averaged away: a thoroughly captured interview still yields a sparse
    // Draft BIF, and reporting only the intake pair would overstate what AGE
    // actually knows.
    discoveryCompletenessScore: mappingMetadata.discoveryCompletenessScore,
    discoveryConfidenceScore: mappingMetadata.discoveryConfidenceScore,
    bifCompletenessScore: context.bifCompletenessScore,
    bifConfidenceScore: context.bifConfidenceScore,
    // `String(...)` keeps the BIF enum out of demo-runtime's own types.
    bifStatus: String(context.bifStatus),
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
