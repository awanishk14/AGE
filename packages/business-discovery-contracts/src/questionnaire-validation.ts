import { z } from 'zod';
import { discoverySectionIdSchema, type DiscoverySectionId } from './enums';
import { discoveryGapSchema, type DiscoveryGap } from './discovery-gap';
import type { BusinessDiscoveryProfile } from './business-discovery-profile';
import type { DiscoveryAnswer } from './discovery-answer';
import {
  type BusinessDiscoveryQuestionnaire,
  type BusinessDiscoveryQuestionnaireQuestion,
  type ProfileSignal,
} from './questionnaire';

/**
 * QuestionnaireValidationResult — the structured, deterministic outcome of
 * validating a `BusinessDiscoveryProfile` against a
 * `BusinessDiscoveryQuestionnaire`. Reports completeness only; it never mutates
 * the profile, never infers strategy, and performs no I/O or AI calls.
 */
export interface QuestionnaireValidationResult {
  readonly questionnaireId: string;
  readonly questionnaireVersion: string;
  readonly valid: boolean;
  readonly answeredRequiredQuestionIds: readonly string[];
  readonly missingRequiredQuestionIds: readonly string[];
  readonly missingRequiredSectionIds: readonly DiscoverySectionId[];
  readonly criticalGaps: readonly DiscoveryGap[];
}

export const questionnaireValidationResultSchema = z.object({
  questionnaireId: z.string().min(1),
  questionnaireVersion: z.string().min(1),
  valid: z.boolean(),
  answeredRequiredQuestionIds: z.array(z.string().min(1)),
  missingRequiredQuestionIds: z.array(z.string().min(1)),
  missingRequiredSectionIds: z.array(discoverySectionIdSchema),
  criticalGaps: z.array(discoveryGapSchema),
});

/** True when a captured answer carries a non-empty value. */
function isAnswered(answer: DiscoveryAnswer): boolean {
  const { value } = answer;
  if (Array.isArray(value)) {
    return value.some((entry) => entry.trim().length > 0);
  }
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Fixed, curated map from a `ProfileSignal` to the predicate that decides whether
 * structured profile data satisfies it. Closed set — deterministic, no
 * inference. `businessName` is always present on a valid profile, so its
 * predicate reflects a non-empty value.
 */
const PROFILE_SIGNAL_PREDICATES: Record<
  ProfileSignal,
  (profile: BusinessDiscoveryProfile) => boolean
> = {
  businessName: (p) => p.businessName.trim().length > 0,
  industry: (p) => (p.industry?.trim().length ?? 0) > 0,
  businessModel: (p) => (p.businessModel?.trim().length ?? 0) > 0,
  brandPositioning: (p) => (p.brandPositioning?.trim().length ?? 0) > 0,
  offerings: (p) => p.offerings.length > 0,
  segments: (p) => p.segments.length > 0,
  competitors: (p) => p.competitors.length > 0,
  goals: (p) => p.goals.length > 0,
  geographies: (p) => p.geographies.length > 0,
  marketingChannels: (p) => p.marketingChannels.length > 0,
  constraints: (p) => p.constraints.length > 0,
  assets: (p) => p.assets.length > 0,
  evidenceSources: (p) => p.evidenceSources.length > 0,
};

/** Collect the ids of every question the profile answers with a non-empty value. */
function collectAnsweredQuestionIds(profile: BusinessDiscoveryProfile): ReadonlySet<string> {
  const answered = new Set<string>();
  for (const section of profile.sections) {
    for (const answer of section.answers) {
      if (isAnswered(answer)) {
        answered.add(answer.questionId);
      }
    }
  }
  return answered;
}

/** A question is satisfied by an explicit answer or by its structured profile signal. */
function isQuestionSatisfied(
  question: BusinessDiscoveryQuestionnaireQuestion,
  profile: BusinessDiscoveryProfile,
  answeredQuestionIds: ReadonlySet<string>,
): boolean {
  if (answeredQuestionIds.has(question.id)) {
    return true;
  }
  if (question.satisfiedBy !== undefined) {
    return PROFILE_SIGNAL_PREDICATES[question.satisfiedBy](profile);
  }
  return false;
}

/**
 * validateProfileAgainstQuestionnaire — pure, deterministic completeness check.
 *
 * Given a profile and a questionnaire definition it reports which required
 * questions are answered (by explicit answer or structured profile signal),
 * which required questions and sections are still missing, and which unsatisfied
 * `critical` questions constitute critical discovery gaps. The input profile is
 * never mutated; results depend only on the inputs (no wall-clock, no I/O).
 */
export function validateProfileAgainstQuestionnaire(
  profile: BusinessDiscoveryProfile,
  questionnaire: BusinessDiscoveryQuestionnaire,
): QuestionnaireValidationResult {
  const answeredQuestionIds = collectAnsweredQuestionIds(profile);

  const answeredRequiredQuestionIds: string[] = [];
  const missingRequiredQuestionIds: string[] = [];
  const missingRequiredSectionIds: DiscoverySectionId[] = [];
  const criticalGaps: DiscoveryGap[] = [];

  for (const section of questionnaire.sections) {
    const requiredQuestions = section.questions.filter((question) => question.required);
    let sectionHasSatisfiedRequired = false;

    for (const question of section.questions) {
      const satisfied = isQuestionSatisfied(question, profile, answeredQuestionIds);

      if (question.required) {
        if (satisfied) {
          answeredRequiredQuestionIds.push(question.id);
          sectionHasSatisfiedRequired = true;
        } else {
          missingRequiredQuestionIds.push(question.id);
        }
      }

      if (question.critical && !satisfied) {
        criticalGaps.push({
          id: `gap-${question.id}`,
          sectionId: question.sectionId,
          missing: question.prompt,
          severity: 'critical',
        });
      }
    }

    if (requiredQuestions.length > 0 && !sectionHasSatisfiedRequired) {
      missingRequiredSectionIds.push(section.id);
    }
  }

  return {
    questionnaireId: questionnaire.id,
    questionnaireVersion: questionnaire.version,
    valid: missingRequiredQuestionIds.length === 0 && missingRequiredSectionIds.length === 0,
    answeredRequiredQuestionIds,
    missingRequiredQuestionIds,
    missingRequiredSectionIds,
    criticalGaps,
  };
}
