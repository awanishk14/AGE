import { z } from 'zod';
import { discoverySectionIdSchema, type DiscoverySectionId } from './enums';
import {
  businessDiscoveryProfileSchema,
  type BusinessDiscoveryProfile,
} from './business-discovery-profile';
import {
  businessDiscoveryQuestionnaireSchema,
  type BusinessDiscoveryQuestionnaire,
  type BusinessDiscoveryQuestionnaireQuestion,
} from './questionnaire';
import { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from './default-questionnaire';
import { validateProfileAgainstQuestionnaire } from './questionnaire-validation';

/**
 * Business Discovery completeness scoring — pure, deterministic, transparent.
 *
 * Turns the boolean/list output of `validateProfileAgainstQuestionnaire` into
 * numeric 0–100 scores. This is the missing input for a future Discovery → BIF
 * wiring slice: the canonical `@age/bif` root requires numeric
 * `completenessScore` / `confidenceScore`, which intake could not previously
 * supply without fabricating them.
 *
 * IMPORTANT — what `discoveryConfidenceScore` means. It is **discovery input
 * confidence**: how well-evidenced and internally complete the *captured
 * profile* is. It is emphatically NOT strategic confidence, not a prediction,
 * and not a judgement about the business itself. Nothing here rates the quality
 * of a strategy, because discovery does not produce one.
 *
 * Every rule below is a fixed arithmetic function of the profile and the
 * questionnaire: no wall-clock, no randomness, no AI/LLM, no I/O, no network,
 * no inference beyond signals literally present in the profile. Evidence source
 * locators are counted, never dereferenced. Inputs are never mutated.
 *
 * BOUNDARY NOTE — this module does not import `@age/bif` and performs no BIF
 * wiring. It only produces the numbers such a wiring slice would need.
 *
 * The two scores are deliberately independent. `completenessScore` asks "how
 * much was captured?"; `discoveryConfidenceScore` asks "how well-sourced is what
 * was captured?". A profile can be complete and unevidenced — that combination
 * scores high completeness and low confidence, and `readinessBand` reflects the
 * weaker of the two. Keeping them independent is what makes them useful to a
 * later BIF wiring slice, which needs both numbers to mean different things.
 *
 * KNOWN LIMITATION (v2.1.0) — evidence coverage depends on **answer-level**
 * citation via `DiscoveryAnswer.evidenceSourceIds`. That is the only place the
 * current contracts can express provenance. When a structured profile field
 * satisfies a questionnaire signal directly (via `satisfiedBy`) rather than
 * through a captured answer, there is nowhere to attach an evidence reference,
 * so the scorer cannot credit that field as evidence-covered — even if the fact
 * genuinely came from a cited source. Consequence: a profile captured entirely
 * through structured fields is ceilinged by `uncitedEvidenceCap` no matter how
 * well-sourced it really is.
 *
 * This is acceptable for now (it errs toward under-claiming confidence, never
 * over-claiming) but it is explicitly called out because a future Discovery →
 * BIF wiring slice needs **field-level provenance**: the canonical BIF requires
 * `source` and `confidence` per field, which this limitation would otherwise
 * silently under-populate. Lifting it means adding field-level evidence
 * references to the discovery contracts — a separate, decided slice.
 */

/**
 * Scoring model version. Bump when weights or rules change so a stored score can
 * be traced to the model that produced it. Not a timestamp — deliberately no
 * wall-clock anywhere in this module.
 */
export const BUSINESS_DISCOVERY_SCORING_VERSION = '2.1.0';

/**
 * Explicit per-section weights, summing to 100 across every
 * `DiscoverySectionId`. Hand-set from the twelve discovery topics the default
 * questionnaire covers: identity/industry/model, offerings, ICP, geography and
 * competitors, positioning, channels, goals and constraints, assets, and
 * evidence/assumptions. Sections that anchor everything downstream (who the
 * business is, what it sells, who it sells to) carry the most weight.
 *
 * When a questionnaire omits sections, the weights of the sections it *does*
 * contain are normalized to total 100 (subject to two-decimal rounding), so any
 * questionnaire yields a 0–100 score.
 */
export const DISCOVERY_SECTION_WEIGHTS: Readonly<Record<DiscoverySectionId, number>> = {
  'business-identity': 18,
  offerings: 15,
  'customers-icp': 15,
  'market-competition': 14,
  'goals-constraints': 14,
  'evidence-assumptions': 7,
  'positioning-brand': 6,
  channels: 6,
  assets: 5,
};

/** Relative weight of a question within its section. Required counts double. */
const REQUIRED_QUESTION_WEIGHT = 2;
const OPTIONAL_QUESTION_WEIGHT = 1;

/** Readiness bands, ordered from least to most ready. */
export const READINESS_BANDS = ['incomplete', 'partial', 'usable', 'strong'] as const;

export type ReadinessBand = (typeof READINESS_BANDS)[number];

export const readinessBandSchema = z.enum(READINESS_BANDS);

/** Lower bound (inclusive) of each band, applied to the completeness score. */
const BAND_THRESHOLDS: readonly (readonly [ReadinessBand, number])[] = [
  ['strong', 90],
  ['usable', 70],
  ['partial', 40],
  ['incomplete', 0],
];

/**
 * Discovery-input-confidence model (v2 — evidence-dominant).
 *
 * There is deliberately **no baseline**: an unevidenced profile earns nothing
 * for merely existing. Evidence is the single largest term (55 of 100) so the
 * score cannot simply mirror `completenessScore`; structured coverage
 * contributes but cannot dominate; and `noEvidenceCap` hard-caps the result when
 * a profile carries no evidence sources at all, so "complete but unevidenced"
 * can never read as confident. Credits and penalties are fixed constants, so any
 * score can be explained arithmetically. Maximum credits sum to exactly 100.
 */
const CONFIDENCE = {
  /** Dominant term. Scaled by `evidenceSignal` (sources present + section coverage). */
  evidenceMax: 55,
  /** Scaled by the fraction of required questions satisfied — this is how
   *  missing required answers reduce confidence, proportionally. */
  requiredCoverageMax: 25,
  /** Scaled by optional structured areas present. Contributes, never dominates. */
  structuredMax: 15,
  /** Flat, small credit for declaring assumptions at all (transparency). Capped
   *  so that declaring many assumptions can never inflate confidence. */
  assumptionTransparencyMax: 5,
  /** Hard ceiling when the profile has zero evidence sources. */
  noEvidenceCap: 35,
  /**
   * Hard ceiling when evidence sources exist but nothing cites them. Set above
   * `noEvidenceCap` (listing sources is marginally better than none) but well
   * below the `strong` band floor, so nominal evidence can never read as ready
   * and can never outrank genuinely cited evidence.
   */
  uncitedEvidenceCap: 45,
  /** Per critical gap, capped — unknowns in critical areas erode trust fastest. */
  criticalGapPenalty: 8,
  criticalGapPenaltyMax: 30,
  /** Per low-confidence assumption, capped — shaky inputs are not free. */
  lowConfidenceAssumptionPenalty: 2,
  lowConfidenceAssumptionPenaltyMax: 8,
} as const;

/**
 * Confidence floors that cap the readiness band. A profile cannot be called
 * `strong` on thin input, however complete it looks — this is what stops a
 * fully-populated but unevidenced profile from reading as ready.
 */
const CONFIDENCE_BAND_CAPS: readonly (readonly [minConfidence: number, cap: ReadinessBand])[] = [
  [60, 'strong'],
  [40, 'usable'],
  [0, 'partial'],
];

/** Per-section completeness detail. Pure data. */
export interface BusinessDiscoverySectionCompleteness {
  readonly sectionId: DiscoverySectionId;
  readonly name: string;
  /** Normalized weight of this section within the questionnaire (0–100). */
  readonly weight: number;
  /** 0–100 completeness of this section alone. */
  readonly score: number;
  /** `weight * score / 100` — this section's contribution to the total. */
  readonly weightedContribution: number;
  readonly satisfiedQuestionIds: readonly string[];
  readonly missingQuestionIds: readonly string[];
}

export const businessDiscoverySectionCompletenessSchema = z.object({
  sectionId: discoverySectionIdSchema,
  name: z.string().min(1),
  weight: z.number().min(0).max(100),
  score: z.number().min(0).max(100),
  weightedContribution: z.number().min(0).max(100),
  satisfiedQuestionIds: z.array(z.string().min(1)),
  missingQuestionIds: z.array(z.string().min(1)),
});

/** Section-by-section breakdown behind the headline completeness score. */
export interface BusinessDiscoveryCompletenessBreakdown {
  readonly sections: readonly BusinessDiscoverySectionCompleteness[];
  /**
   * The actual sum of the `weight` values reported above — computed, never
   * asserted. Normalization targets 100, but because each section weight is
   * rounded to two decimals some subsets legitimately total 99.99 or 100.01.
   */
  readonly totalWeight: number;
}

export const businessDiscoveryCompletenessBreakdownSchema = z.object({
  sections: z.array(businessDiscoverySectionCompletenessSchema),
  totalWeight: z.number().min(0).max(100),
});

/**
 * BusinessDiscoveryCompletenessScore — the full, explainable scoring result.
 *
 * `completenessScore` = how much discovery information exists.
 * `discoveryConfidenceScore` = how well-evidenced that information is
 * (**discovery input confidence, never strategy confidence**).
 * `readinessBand` = a coarse label derived from both, demoted while required
 * answers or critical gaps remain outstanding.
 */
export interface BusinessDiscoveryCompletenessScore {
  readonly scoringVersion: string;
  readonly questionnaireId: string;
  readonly questionnaireVersion: string;
  readonly profileId: string;
  /** 0–100. */
  readonly completenessScore: number;
  /** 0–100. Discovery *input* confidence — not strategic confidence. */
  readonly discoveryConfidenceScore: number;
  readonly readinessBand: ReadinessBand;
  readonly breakdown: BusinessDiscoveryCompletenessBreakdown;
  readonly missingRequiredCount: number;
  readonly criticalGapCount: number;
  readonly evidenceReferenceCount: number;
  readonly assumptionCount: number;
  /** Short machine-readable codes, e.g. `critical-gaps-present`. */
  readonly reasons: readonly string[];
}

export const businessDiscoveryCompletenessScoreSchema = z.object({
  scoringVersion: z.string().min(1),
  questionnaireId: z.string().min(1),
  questionnaireVersion: z.string().min(1),
  profileId: z.string().min(1),
  completenessScore: z.number().min(0).max(100),
  discoveryConfidenceScore: z.number().min(0).max(100),
  readinessBand: readinessBandSchema,
  breakdown: businessDiscoveryCompletenessBreakdownSchema,
  missingRequiredCount: z.number().int().min(0),
  criticalGapCount: z.number().int().min(0),
  evidenceReferenceCount: z.number().int().min(0),
  assumptionCount: z.number().int().min(0),
  reasons: z.array(z.string().min(1)),
});

/** Clamp to the 0–100 range and round to a whole number. */
function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Round to two decimals — keeps breakdown arithmetic legible and stable. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Optional structured areas that signal a richer profile. Used only as a
 * confidence signal; completeness is driven by the questionnaire itself.
 */
const STRUCTURED_SIGNALS: readonly ((profile: BusinessDiscoveryProfile) => boolean)[] = [
  (p) => (p.industry?.trim().length ?? 0) > 0,
  (p) => (p.businessModel?.trim().length ?? 0) > 0,
  (p) => (p.brandPositioning?.trim().length ?? 0) > 0,
  (p) => p.competitors.length > 0,
  (p) => p.marketingChannels.length > 0,
  (p) => p.constraints.length > 0,
  (p) => p.assets.length > 0,
  (p) => p.segments.length > 0,
];

/** Evidence sources needed before the "sources present" half of the signal saturates. */
const EVIDENCE_SOURCE_TARGET = 5;

/** True when any captured answer in this profile section cites an evidence source. */
function hasEvidenceLinkedAnswer(section: BusinessDiscoveryProfile['sections'][number]): boolean {
  return section.answers.some((answer) => (answer.evidenceSourceIds?.length ?? 0) > 0);
}

/**
 * Fraction of the questionnaire's sections for which the profile captures at
 * least one evidence-linked answer.
 *
 * Measured against the *questionnaire's* section count, not the profile's own
 * answers — otherwise a profile answering one question with one citation would
 * score a perfect ratio, which is the saturation flaw this replaces. Evidence
 * breadth across the discovery surface is what actually indicates a
 * well-sourced profile.
 */
function evidenceSectionCoverage(
  profile: BusinessDiscoveryProfile,
  questionnaire: BusinessDiscoveryQuestionnaire,
): number {
  if (questionnaire.sections.length === 0) {
    return 0;
  }
  const covered = new Set<DiscoverySectionId>();
  for (const section of profile.sections) {
    if (hasEvidenceLinkedAnswer(section)) {
      covered.add(section.id);
    }
  }
  const relevant = questionnaire.sections.filter((section) => covered.has(section.id)).length;
  return relevant / questionnaire.sections.length;
}

/**
 * Evidence signal in 0–1.
 *
 * When any evidence is actually cited, the signal is half source count
 * (saturating at `EVIDENCE_SOURCE_TARGET`) and half citation breadth across the
 * questionnaire's sections.
 *
 * When **nothing is cited**, source count earns only `UNCITED_PRESENCE_FACTOR`
 * of its usual credit. A list of sources nobody ever pointed an answer at is a
 * claim, not evidence — without this, adding uncited sources would be the
 * cheapest way to raise confidence, and a profile citing nothing could outrank
 * one that cites properly.
 */
function evidenceSignal(presence: number, coverage: number): number {
  if (coverage === 0) {
    return presence * UNCITED_PRESENCE_FACTOR;
  }
  return presence * 0.5 + coverage * 0.5;
}

/** Fraction of the usual presence credit earned when no evidence is ever cited. */
const UNCITED_PRESENCE_FACTOR = 0.15;

/** Weight of one question within its section. */
function questionWeight(question: BusinessDiscoveryQuestionnaireQuestion): number {
  return question.required ? REQUIRED_QUESTION_WEIGHT : OPTIONAL_QUESTION_WEIGHT;
}

/**
 * calculateBusinessDiscoveryCompleteness — score a profile against a
 * questionnaire (the curated default when none is supplied).
 *
 * Pure and deterministic: identical inputs always produce an identical result.
 * Both arguments are validated at the boundary and never mutated; scoring reads
 * only the questionnaire definition and data literally present on the profile.
 *
 * @throws if the profile or questionnaire fails its Zod schema.
 */
export function calculateBusinessDiscoveryCompleteness(
  profile: BusinessDiscoveryProfile,
  questionnaire: BusinessDiscoveryQuestionnaire = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
): BusinessDiscoveryCompletenessScore {
  const parsedProfile = businessDiscoveryProfileSchema.safeParse(profile);
  if (!parsedProfile.success) {
    throw new Error(
      `Cannot score an invalid business discovery profile: ${parsedProfile.error.message}`,
    );
  }
  const parsedQuestionnaire = businessDiscoveryQuestionnaireSchema.safeParse(questionnaire);
  if (!parsedQuestionnaire.success) {
    throw new Error(
      `Cannot score against an invalid business discovery questionnaire: ${parsedQuestionnaire.error.message}`,
    );
  }

  const validation = validateProfileAgainstQuestionnaire(profile, questionnaire);
  const satisfiedRequired = new Set(validation.answeredRequiredQuestionIds);
  const missingRequired = new Set(validation.missingRequiredQuestionIds);

  // Normalize the declared weights across the sections this questionnaire uses,
  // so any subset of sections still totals 100.
  const declaredWeightTotal = questionnaire.sections.reduce(
    (sum, section) => sum + DISCOVERY_SECTION_WEIGHTS[section.id],
    0,
  );

  const sections: BusinessDiscoverySectionCompleteness[] = questionnaire.sections.map((section) => {
    const normalizedWeight =
      declaredWeightTotal === 0
        ? 0
        : (DISCOVERY_SECTION_WEIGHTS[section.id] / declaredWeightTotal) * 100;

    let earned = 0;
    let possible = 0;
    const satisfiedQuestionIds: string[] = [];
    const missingQuestionIds: string[] = [];

    for (const question of section.questions) {
      const weight = questionWeight(question);
      possible += weight;

      // A required question's satisfaction is already decided by the validator.
      // Optional questions are satisfied the same way — via explicit answer or
      // structured profile signal — which `validateProfileAgainstQuestionnaire`
      // does not report, so re-derive it from the same inputs it uses.
      const satisfied = question.required
        ? satisfiedRequired.has(question.id)
        : isOptionalQuestionSatisfied(question, profile, questionnaire);

      if (satisfied) {
        earned += weight;
        satisfiedQuestionIds.push(question.id);
      } else {
        missingQuestionIds.push(question.id);
      }
    }

    const score = possible === 0 ? 0 : (earned / possible) * 100;

    return {
      sectionId: section.id,
      name: section.name,
      weight: round2(normalizedWeight),
      score: round2(score),
      weightedContribution: round2((normalizedWeight * score) / 100),
      satisfiedQuestionIds,
      missingQuestionIds,
    };
  });

  const completenessRaw = sections.reduce((sum, section) => sum + section.weightedContribution, 0);
  const completenessScore = clampScore(completenessRaw);

  // ---- Discovery input confidence -----------------------------------------
  const requiredTotal = satisfiedRequired.size + missingRequired.size;
  const requiredCoverage = requiredTotal === 0 ? 1 : satisfiedRequired.size / requiredTotal;

  const structuredCoverage =
    STRUCTURED_SIGNALS.filter((signal) => signal(profile)).length / STRUCTURED_SIGNALS.length;

  const lowConfidenceAssumptions = profile.assumptions.filter(
    (assumption) => assumption.confidence === 'low',
  ).length;

  const evidencePresence =
    Math.min(profile.evidenceSources.length, EVIDENCE_SOURCE_TARGET) / EVIDENCE_SOURCE_TARGET;
  const evidenceCoverage = evidenceSectionCoverage(profile, questionnaire);

  // No baseline: nothing is earned for merely being a schema-valid profile.
  const confidenceRaw =
    evidenceSignal(evidencePresence, evidenceCoverage) * CONFIDENCE.evidenceMax +
    requiredCoverage * CONFIDENCE.requiredCoverageMax +
    structuredCoverage * CONFIDENCE.structuredMax +
    (profile.assumptions.length > 0 ? CONFIDENCE.assumptionTransparencyMax : 0) -
    Math.min(
      validation.criticalGaps.length * CONFIDENCE.criticalGapPenalty,
      CONFIDENCE.criticalGapPenaltyMax,
    ) -
    Math.min(
      lowConfidenceAssumptions * CONFIDENCE.lowConfidenceAssumptionPenalty,
      CONFIDENCE.lowConfidenceAssumptionPenaltyMax,
    );

  // Hard ceilings on thin evidence. However complete the capture looks, input
  // that is unevidenced — or whose sources are listed but never cited — cannot
  // be called confident, and cannot outrank properly cited input.
  const uncappedConfidence = clampScore(confidenceRaw);
  const confidenceCeiling =
    profile.evidenceSources.length === 0
      ? CONFIDENCE.noEvidenceCap
      : evidenceCoverage === 0
        ? CONFIDENCE.uncitedEvidenceCap
        : 100;
  const discoveryConfidenceScore = Math.min(uncappedConfidence, confidenceCeiling);

  /** Which ceiling actually bound the score — reported as a limiting reason. */
  const bindingCap: 'no-evidence' | 'uncited-evidence' | undefined =
    uncappedConfidence <= confidenceCeiling
      ? undefined
      : profile.evidenceSources.length === 0
        ? 'no-evidence'
        : 'uncited-evidence';

  const readinessBand = deriveReadinessBand(
    completenessScore,
    discoveryConfidenceScore,
    validation.missingRequiredQuestionIds.length,
    validation.criticalGaps.length,
  );

  return {
    scoringVersion: BUSINESS_DISCOVERY_SCORING_VERSION,
    questionnaireId: validation.questionnaireId,
    questionnaireVersion: validation.questionnaireVersion,
    profileId: profile.id,
    completenessScore,
    discoveryConfidenceScore,
    readinessBand,
    breakdown: {
      sections,
      // Computed from the weights actually reported, never asserted. Rounding
      // each section to two decimals means this can land a hundredth off 100
      // for some section subsets; reporting the real sum is the honest choice.
      totalWeight: round2(sections.reduce((sum, section) => sum + section.weight, 0)),
    },
    missingRequiredCount: validation.missingRequiredQuestionIds.length,
    criticalGapCount: validation.criticalGaps.length,
    evidenceReferenceCount: profile.evidenceSources.length,
    assumptionCount: profile.assumptions.length,
    reasons: buildReasons(
      sections,
      profile,
      validation.criticalGaps.length,
      lowConfidenceAssumptions,
      bindingCap,
    ),
  };
}

/**
 * Optional questions are not reported by the validator, so re-derive their
 * satisfaction from the same two deterministic sources it uses: an explicit
 * non-empty answer, or the question's structured `satisfiedBy` profile signal.
 */
function isOptionalQuestionSatisfied(
  question: BusinessDiscoveryQuestionnaireQuestion,
  profile: BusinessDiscoveryProfile,
  questionnaire: BusinessDiscoveryQuestionnaire,
): boolean {
  const probe: BusinessDiscoveryQuestionnaire = {
    ...questionnaire,
    sections: [
      {
        id: question.sectionId,
        name: 'probe',
        questions: [{ ...question, required: true, critical: false }],
      },
    ],
  };
  return validateProfileAgainstQuestionnaire(profile, probe).answeredRequiredQuestionIds.includes(
    question.id,
  );
}

/** The weaker of two bands, by declaration order in `READINESS_BANDS`. */
function lowerBand(a: ReadinessBand, b: ReadinessBand): ReadinessBand {
  return READINESS_BANDS.indexOf(a) <= READINESS_BANDS.indexOf(b) ? a : b;
}

/**
 * Readiness starts from the completeness score and is then capped by two
 * independent trust checks — a profile is only as ready as its weakest signal:
 *
 * 1. Outstanding required answers or critical gaps cap it at `partial`.
 * 2. Input confidence caps it via `CONFIDENCE_BAND_CAPS` — under 60 it cannot be
 *    `strong`, under 40 it cannot exceed `partial`. This is what prevents a
 *    fully-populated but unevidenced profile from reading as ready.
 */
function deriveReadinessBand(
  completenessScore: number,
  discoveryConfidenceScore: number,
  missingRequiredCount: number,
  criticalGapCount: number,
): ReadinessBand {
  let band =
    BAND_THRESHOLDS.find(([, threshold]) => completenessScore >= threshold)?.[0] ?? 'incomplete';

  if (criticalGapCount > 0 || missingRequiredCount > 0) {
    band = lowerBand(band, 'partial');
  }

  const confidenceCap =
    CONFIDENCE_BAND_CAPS.find(
      ([minConfidence]) => discoveryConfidenceScore >= minConfidence,
    )?.[1] ?? 'incomplete';

  return lowerBand(band, confidenceCap);
}

/** Short, machine-readable explanation codes. Order is deterministic. */
function buildReasons(
  sections: readonly BusinessDiscoverySectionCompleteness[],
  profile: BusinessDiscoveryProfile,
  criticalGapCount: number,
  lowConfidenceAssumptions: number,
  bindingCap: 'no-evidence' | 'uncited-evidence' | undefined,
): readonly string[] {
  const reasons: string[] = [];

  // Report a binding ceiling first: it is the single most important limiting
  // fact about the score, not a footnote.
  if (bindingCap !== undefined) {
    reasons.push(`confidence-capped:${bindingCap}`);
  }

  if (criticalGapCount > 0) {
    reasons.push('critical-gaps-present');
  } else {
    reasons.push('no-critical-gaps');
  }

  if (profile.evidenceSources.length === 0) {
    reasons.push('no-evidence-sources');
  } else if (!profile.sections.some(hasEvidenceLinkedAnswer)) {
    reasons.push('evidence-sources-unlinked');
  } else {
    reasons.push('evidence-backed');
  }

  if (profile.assumptions.length === 0) {
    reasons.push('no-assumptions-declared');
  } else if (lowConfidenceAssumptions > 0) {
    reasons.push('low-confidence-assumptions');
  } else {
    reasons.push('assumptions-declared');
  }

  for (const section of sections) {
    if (section.score === 0) {
      reasons.push(`section-empty:${section.sectionId}`);
    } else if (section.score < 100) {
      reasons.push(`section-incomplete:${section.sectionId}`);
    }
  }

  if (reasons.every((reason) => !reason.startsWith('section-'))) {
    reasons.push('all-sections-complete');
  }

  return reasons;
}
