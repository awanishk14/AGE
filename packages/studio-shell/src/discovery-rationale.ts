import {
  PROFILE_SIGNAL_TARGETS,
  type BusinessDiscoveryQuestionnaireQuestion,
  type ProfileSignal,
} from '@age/business-discovery-contracts';

/**
 * Why each question is asked (ADR-0059 D6 item 2).
 *
 * ⚠️ The intake reads as a form rather than as an interview because nothing on
 * the screen says what any answer is FOR. This module supplies that, and it is
 * held to the same standard as everything else AGE renders: every sentence here
 * must be a true statement about code that exists on `main`.
 *
 * 🚫 IT IS NOT COPYWRITING, AND IT NEVER MOTIVATES. There is no "this helps us
 * serve you better". Each entry says which profile field the answer becomes and
 * what stops working without it — both checkable by reading
 * `build-profile-from-answers.ts`.
 *
 * ⚠️ The FIELD NAME IS NOT RESTATED HERE. It is read from
 * `PROFILE_SIGNAL_TARGETS`, the mapper's own routing table, so a field that gets
 * renamed cannot leave a stale name on the operator's screen.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

export interface QuestionRationale {
  /** The profile field this answer becomes, read from the mapper's own table. */
  readonly profileField: string;
  /** What this answer is for. One sentence, present tense, no persuasion. */
  readonly feeds: string;
  /**
   * What leaving it blank actually costs.
   *
   * 🚫 Never a threat and never a score. Absence is a limitation, never negative
   * evidence (ADR-0026 D4), and this text must not imply otherwise.
   */
  readonly ifBlank: string;
}

/**
 * ⚠️ EXHAUSTIVE OVER `ProfileSignal` BY TYPE — a new signal without an entry is
 * a compile error, and a test pins it to the same closed set. Without that, a
 * new question would silently render no explanation at all, which is the
 * failure this module exists to fix.
 */
const RATIONALE_BY_SIGNAL: Readonly<
  Record<ProfileSignal, Omit<QuestionRationale, 'profileField'>>
> = {
  businessName: {
    feeds: 'Names the business in every profile, BIF and report AGE produces about it.',
    ifBlank: 'The profile cannot be built at all — this is the one answer with no substitute.',
  },
  industry: {
    feeds: 'Sets the industry the BIF reasons within.',
    ifBlank: 'Nothing downstream infers it from the business name. It stays unknown.',
  },
  businessModel: {
    feeds: 'Records how the business makes money, in your words.',
    ifBlank: 'The BIF carries no business model rather than a guessed one.',
  },
  brandPositioning: {
    feeds: 'Records how the brand sits against its alternatives.',
    ifBlank: 'Positioning stays unstated. AGE does not derive it from competitors.',
  },
  offerings: {
    feeds:
      'Becomes the list of products or services. Whether an entry is a product or a service ' +
      'comes from the question you are answering, never from how you word the answer.',
    ifBlank: 'The BIF has nothing to reason about offerings with.',
  },
  segments: {
    feeds: 'Becomes the customer segments the BIF reasons about.',
    ifBlank: 'Every audience judgement downstream has nothing to stand on.',
  },
  geographies: {
    feeds: 'Records which markets are served.',
    ifBlank: 'Reach stays unstated. It is not inferred from the business name or industry.',
  },
  competitors: {
    feeds: 'Becomes the named competitor set.',
    ifBlank: 'AGE does not look competitors up. An empty set means nobody named any.',
  },
  marketingChannels: {
    feeds: 'Records the channels currently in use.',
    ifBlank: 'Channel coverage is not assessed rather than reported as none.',
  },
  goals: {
    feeds: 'Becomes the business goals capabilities are read against.',
    ifBlank: 'There is no stated intent to measure anything against.',
  },
  constraints: {
    feeds: 'Records the limits any recommendation has to respect.',
    ifBlank: 'Constraints are unknown, which is not the same as there being none.',
  },
  assets: {
    feeds: 'Records what already exists to work with — lists, content, audiences.',
    ifBlank: 'Assets are unknown. AGE never assumes an asset exists.',
  },
  evidenceSources: {
    feeds:
      'Becomes the evidence a captured fact can be attributed to. The kind of source comes ' +
      'from the question you are answering, never from the text you type.',
    ifBlank:
      'Facts can still be captured, but they are unattributed — AGE will say so rather than ' +
      'treat them as evidenced.',
  },
};

/**
 * The rationale for one question, or `undefined` if it has none.
 *
 * 🚫 A question with no `satisfiedBy` gets NO INVENTED EXPLANATION. It declares
 * no route into the profile, so there is nothing true to say about what it
 * feeds, and a plausible sentence in its place would be exactly the kind of
 * confident falsehood this product exists to refuse.
 */
export function rationaleFor(
  question: BusinessDiscoveryQuestionnaireQuestion,
): QuestionRationale | undefined {
  if (question.satisfiedBy === undefined) return undefined;

  const target = PROFILE_SIGNAL_TARGETS[question.satisfiedBy];
  if (target.kind === 'untranscribable') return undefined;

  return { profileField: target.field, ...RATIONALE_BY_SIGNAL[question.satisfiedBy] };
}

/** The signals this module explains, for the drift guard. */
export const EXPLAINED_SIGNALS: readonly ProfileSignal[] = Object.freeze(
  Object.keys(RATIONALE_BY_SIGNAL).sort() as ProfileSignal[],
);
