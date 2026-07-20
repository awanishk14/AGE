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
 * KNOWN LIMITATION (v1.0.0) — the evidence signal's "backed answer ratio" is
 * relative to the answers a profile actually captures, so a profile with one
 * evidence-linked answer scores the same on that half of the signal as one with
 * fifty. It measures evidence *discipline*, not evidence *volume*. Making it
 * volume-sensitive needs a defensible target answer count, which the current
 * questionnaire does not define; revisit when explicit answer capture grows
 * beyond the sample fixture.
 */

/**
 * Scoring model version. Bump when weights or rules change so a stored score can
 * be traced to the model that produced it. Not a timestamp — deliberately no
 * wall-clock anywhere in this module.
 */
export const BUSINESS_DISCOVERY_SCORING_VERSION = '1.0.0';

/**
 * Explicit per-section weights, summing to 100 across every
 * `DiscoverySectionId`. Hand-set from the twelve discovery topics the default
 * questionnaire covers: identity/industry/model, offerings, ICP, geography and
 * competitors, positioning, channels, goals and constraints, assets, and
 * evidence/assumptions. Sections that anchor everything downstream (who the
 * business is, what it sells, who it sells to) carry the most weight.
 *
 * When a questionnaire omits sections, the weights of the sections it *does*
 * contain are normalized to 100 — so any questionnaire yields a 0–100 score.
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
 * Discovery-input-confidence model. Credits and penalties are fixed constants so
 * a score can be explained arithmetically. Baseline + maximum credits = 100.
 */
const CONFIDENCE = {
  /** A schema-valid profile with nothing else going for it starts here. */
  baseline: 40,
  /** Scaled by the fraction of required questions satisfied. */
  requiredCoverageMax: 25,
  /** Scaled by how much of the profile is backed by evidence references. */
  evidenceMax: 20,
  /** Scaled by how many optional structured areas carry content. */
  structuredMax: 10,
  /** Capped credit for explicitly declaring assumptions (transparency). */
  assumptionTransparencyMax: 5,
  /** Per critical gap, capped — unknowns in critical areas erode trust fastest. */
  criticalGapPenalty: 8,
  criticalGapPenaltyMax: 30,
  /** Per low-confidence assumption, capped — shaky inputs are not free. */
  lowConfidenceAssumptionPenalty: 2,
  lowConfidenceAssumptionPenaltyMax: 8,
} as const;

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
  /** Sum of normalized section weights — 100 for any non-empty questionnaire. */
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

/** How much of the captured answer set carries at least one evidence reference. */
function evidenceBackedAnswerRatio(profile: BusinessDiscoveryProfile): number {
  let total = 0;
  let backed = 0;
  for (const section of profile.sections) {
    for (const answer of section.answers) {
      total += 1;
      if ((answer.evidenceSourceIds?.length ?? 0) > 0) {
        backed += 1;
      }
    }
  }
  return total === 0 ? 0 : backed / total;
}

/**
 * Evidence signal in 0–1: half from having evidence sources at all (saturating
 * at three), half from how much of the answer set is actually backed by them.
 */
function evidenceSignal(profile: BusinessDiscoveryProfile): number {
  const presence = Math.min(profile.evidenceSources.length, 3) / 3;
  return presence * 0.5 + evidenceBackedAnswerRatio(profile) * 0.5;
}

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

  const confidenceRaw =
    CONFIDENCE.baseline +
    requiredCoverage * CONFIDENCE.requiredCoverageMax +
    evidenceSignal(profile) * CONFIDENCE.evidenceMax +
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

  const discoveryConfidenceScore = clampScore(confidenceRaw);

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
    breakdown: { sections, totalWeight: round2(declaredWeightTotal === 0 ? 0 : 100) },
    missingRequiredCount: validation.missingRequiredQuestionIds.length,
    criticalGapCount: validation.criticalGaps.length,
    evidenceReferenceCount: profile.evidenceSources.length,
    assumptionCount: profile.assumptions.length,
    reasons: buildReasons(
      sections,
      profile,
      validation.criticalGaps.length,
      lowConfidenceAssumptions,
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

/**
 * Band from the completeness score, then demoted while discovery is not
 * trustworthy: outstanding critical gaps or missing required answers cap the
 * band, and weak input confidence prevents claiming `strong`.
 */
function deriveReadinessBand(
  completenessScore: number,
  discoveryConfidenceScore: number,
  missingRequiredCount: number,
  criticalGapCount: number,
): ReadinessBand {
  const base =
    BAND_THRESHOLDS.find(([, threshold]) => completenessScore >= threshold)?.[0] ?? 'incomplete';

  if (criticalGapCount > 0 || missingRequiredCount > 0) {
    // Cannot be better than `partial` while required/critical items are open.
    return base === 'strong' || base === 'usable' ? 'partial' : base;
  }
  if (base === 'strong' && discoveryConfidenceScore < 60) {
    return 'usable';
  }
  return base;
}

/** Short, machine-readable explanation codes. Order is deterministic. */
function buildReasons(
  sections: readonly BusinessDiscoverySectionCompleteness[],
  profile: BusinessDiscoveryProfile,
  criticalGapCount: number,
  lowConfidenceAssumptions: number,
): readonly string[] {
  const reasons: string[] = [];

  if (criticalGapCount > 0) {
    reasons.push('critical-gaps-present');
  } else {
    reasons.push('no-critical-gaps');
  }

  if (profile.evidenceSources.length === 0) {
    reasons.push('no-evidence-sources');
  } else if (evidenceBackedAnswerRatio(profile) === 0) {
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
