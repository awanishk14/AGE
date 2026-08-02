import type {
  BusinessDiscoveryQuestionnaire,
  BusinessDiscoveryQuestionnaireQuestion,
  DiscoveryAnswer,
} from '@age/business-discovery-contracts';

/**
 * ADR-0054 D1 — a real client's answers arrive as an operator-authored JSON
 * file, parsed and validated AGAINST THE QUESTIONNAIRE.
 *
 * ⚠️ Parsing is fail-closed and TOTAL. An unknown `questionId`, a `value` whose
 * shape contradicts the question's `kind`, or a malformed file is a REFUSAL
 * naming the offending id — never a silently dropped answer. A dropped answer
 * would raise the completeness score of a profile that is missing data, which
 * is the exact failure mode ADR-0051's erratum exists to prevent.
 *
 * ⚠️ This validates STRUCTURE, not truth. ADR-0054 §0.1c, affirmed by the
 * Product Owner: validation "cannot determine whether a human's business answer
 * is correct". That limitation is inherent to manual onboarding and is not
 * mitigated here.
 *
 * 🚫 No defaults are supplied for a missing answer. An unanswered question is
 * ABSENT, never an empty string (ADR-0026 D4).
 *
 * Pure: no clock, no id generation, no randomness, no I/O. The file's bytes
 * arrive as a string from the caller.
 */

/** Refusal raised when an answer file cannot be accepted. */
export class DiscoveryAnswerFileError extends Error {
  /** The offending question id, when the refusal is attributable to one. */
  readonly questionId?: string;

  constructor(message: string, questionId?: string) {
    super(message);
    this.name = 'DiscoveryAnswerFileError';
    this.questionId = questionId;
  }
}

/** Keys an answer entry may carry. Anything else is refused, never ignored. */
const ALLOWED_ANSWER_KEYS = new Set(['questionId', 'value', 'evidenceSourceIds']);

/** Question kinds whose value is a single string. */
const SCALAR_KINDS = new Set(['text', 'longText', 'choice']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function indexQuestions(
  questionnaire: BusinessDiscoveryQuestionnaire,
): ReadonlyMap<string, BusinessDiscoveryQuestionnaireQuestion> {
  const index = new Map<string, BusinessDiscoveryQuestionnaireQuestion>();
  for (const section of questionnaire.sections) {
    for (const question of section.questions) {
      index.set(question.id, question);
    }
  }
  return index;
}

function validateScalar(value: unknown, question: BusinessDiscoveryQuestionnaireQuestion): string {
  if (typeof value !== 'string') {
    throw new DiscoveryAnswerFileError(
      `Question "${question.id}" is of kind "${question.kind}" and expects a single string value, ` +
        `but the file supplied ${Array.isArray(value) ? 'an array' : typeof value}.`,
      question.id,
    );
  }

  if (value.trim() === '') {
    throw new DiscoveryAnswerFileError(
      `Question "${question.id}" was answered with an empty value. An unanswered question must be ` +
        'OMITTED from the file entirely — an empty string is not an answer, and recording one ' +
        'would overstate how complete the profile is.',
      question.id,
    );
  }

  if (question.kind === 'choice') {
    const choices = question.choices ?? [];
    if (!choices.includes(value)) {
      throw new DiscoveryAnswerFileError(
        `Question "${question.id}" only accepts one of its declared choices ` +
          `(${choices.map((choice) => `"${choice}"`).join(', ')}), but the file supplied ` +
          `"${value}".`,
        question.id,
      );
    }
  }

  return value;
}

function validateList(
  value: unknown,
  question: BusinessDiscoveryQuestionnaireQuestion,
): readonly string[] {
  if (!Array.isArray(value)) {
    throw new DiscoveryAnswerFileError(
      `Question "${question.id}" is of kind "list" and expects an array of strings, but the file ` +
        `supplied ${typeof value}. Several values must be separate array entries — this layer ` +
        'never splits one string into many (ADR-0050 D2: transcribe, never infer).',
      question.id,
    );
  }

  if (value.length === 0) {
    throw new DiscoveryAnswerFileError(
      `Question "${question.id}" was answered with an empty list. An unanswered question must be ` +
        'OMITTED from the file entirely rather than answered with nothing.',
      question.id,
    );
  }

  return value.map((entry, position) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new DiscoveryAnswerFileError(
        `Question "${question.id}" has a blank or non-string entry at position ${position}. ` +
          'Every list entry must be a non-empty string.',
        question.id,
      );
    }
    return entry;
  });
}

function validateEvidenceSourceIds(
  raw: unknown,
  questionId: string,
): readonly string[] | undefined {
  if (raw === undefined) return undefined;

  if (!Array.isArray(raw)) {
    throw new DiscoveryAnswerFileError(
      `Question "${questionId}" has an "evidenceSourceIds" that is not an array.`,
      questionId,
    );
  }

  return raw.map((entry, position) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new DiscoveryAnswerFileError(
        `Question "${questionId}" has a blank or non-string evidence source id at position ` +
          `${position}.`,
        questionId,
      );
    }
    return entry;
  });
}

/**
 * Parses and validates an operator-authored answer file.
 *
 * @param rawText  The file's contents. Read by the caller; this function never
 *                 touches the filesystem.
 * @param questionnaire The questionnaire the answers must conform to. Required
 *                 — there is no default (ADR-0049 D2).
 *
 * @throws {DiscoveryAnswerFileError} on any malformed, unknown, mismatched or
 *         empty answer, naming the offending question id where there is one.
 */
export function parseDiscoveryAnswerFile(
  rawText: string,
  questionnaire: BusinessDiscoveryQuestionnaire,
): readonly DiscoveryAnswer[] {
  let document: unknown;
  try {
    document = JSON.parse(rawText) as unknown;
  } catch (error) {
    throw new DiscoveryAnswerFileError(
      `The answer file is not valid JSON: ${(error as Error).message}`,
    );
  }

  if (!isPlainObject(document)) {
    throw new DiscoveryAnswerFileError(
      'The answer file must contain a JSON object with "questionnaireId", ' +
        '"questionnaireVersion" and "answers".',
    );
  }

  // Pinning the questionnaire is what makes "validated against the
  // questionnaire" verifiable rather than assumed: a file written against an
  // older version may answer questions whose meaning has since changed.
  if (document.questionnaireId !== questionnaire.id) {
    throw new DiscoveryAnswerFileError(
      `The answer file declares questionnaire "${String(document.questionnaireId)}" but was ` +
        `validated against "${questionnaire.id}".`,
    );
  }

  if (document.questionnaireVersion !== questionnaire.version) {
    throw new DiscoveryAnswerFileError(
      `The answer file declares questionnaire version ` +
        `"${String(document.questionnaireVersion)}" but was validated against ` +
        `"${questionnaire.version}". Re-answer against the current questionnaire rather than ` +
        'assuming the questions still mean the same thing.',
    );
  }

  const rawAnswers = document.answers;
  if (!Array.isArray(rawAnswers)) {
    throw new DiscoveryAnswerFileError('The answer file must contain an "answers" array.');
  }

  const questions = indexQuestions(questionnaire);
  const seen = new Set<string>();

  const answers = rawAnswers.map((entry, position): DiscoveryAnswer => {
    if (!isPlainObject(entry)) {
      throw new DiscoveryAnswerFileError(`The answer at position ${position} is not an object.`);
    }

    const questionId = entry.questionId;
    if (typeof questionId !== 'string' || questionId.trim() === '') {
      throw new DiscoveryAnswerFileError(`The answer at position ${position} has no "questionId".`);
    }

    for (const key of Object.keys(entry)) {
      if (!ALLOWED_ANSWER_KEYS.has(key)) {
        throw new DiscoveryAnswerFileError(
          `Question "${questionId}" carries an unrecognised property "${key}". It is refused ` +
            "rather than ignored, because a typo'd key would otherwise be silently discarded.",
          questionId,
        );
      }
    }

    const question = questions.get(questionId);
    if (question === undefined) {
      throw new DiscoveryAnswerFileError(
        `The answer file refers to question "${questionId}", which does not exist in ` +
          `questionnaire "${questionnaire.id}".`,
        questionId,
      );
    }

    if (seen.has(questionId)) {
      throw new DiscoveryAnswerFileError(
        `Question "${questionId}" is answered more than once. Accepting one of them would mean ` +
          'choosing silently which answer to discard.',
        questionId,
      );
    }
    seen.add(questionId);

    const value = SCALAR_KINDS.has(question.kind)
      ? validateScalar(entry.value, question)
      : validateList(entry.value, question);

    const evidenceSourceIds = validateEvidenceSourceIds(entry.evidenceSourceIds, questionId);

    return Object.freeze(
      evidenceSourceIds === undefined
        ? { questionId, value }
        : { questionId, value, evidenceSourceIds },
    );
  });

  return Object.freeze(answers);
}
