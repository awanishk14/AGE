import type {
  BusinessDiscoveryQuestionnaire,
  BusinessDiscoveryQuestionnaireQuestion,
} from '@age/business-discovery-contracts';
import { DiscoveryAnswerFileError, parseDiscoveryAnswerFile } from '@age/discovery-answer-file';

/**
 * The operator's in-progress discovery answers.
 *
 * ⚠️ A DRAFT IS NOT AN ANSWER FILE. A draft may be incomplete, and being
 * incomplete is its normal state — that is the whole point of autosaving one.
 * The Answer File remains the canonical artifact; this module's job is to
 * produce exactly that artifact from the operator's typing, so the CLI, the
 * tests and every importer keep consuming one format.
 *
 * 🚫 There is NO second validator here. Submission is validated by rendering
 * the canonical file and handing it to `parseDiscoveryAnswerFile` — the same
 * function the CLI uses. A parallel implementation would drift, and the copy
 * that got relaxed would still pass its own tests.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/** A single drafted value. `list` questions hold an array; the rest a string. */
export type DiscoveryDraftValue = string | readonly string[];

export interface DiscoveryDraft {
  readonly questionnaireId: string;
  readonly questionnaireVersion: string;
  /** Answered questions only. 🚫 An unanswered question is ABSENT, never ''. */
  readonly answers: Readonly<Record<string, DiscoveryDraftValue>>;
}

/**
 * ⚠️ `list` is the only kind whose value is an array — mirroring the parser,
 * which treats `text`, `longText` and `choice` as scalars. 🚫 Do not widen this
 * by guessing from the prompt: the kind is declared on the QUESTION
 * (ADR-0051 D2/D3), never inferred.
 */
export function isListQuestion(question: BusinessDiscoveryQuestionnaireQuestion): boolean {
  return question.kind === 'list';
}

/** An empty draft pinned to the questionnaire it was started against. */
export function emptyDraft(questionnaire: BusinessDiscoveryQuestionnaire): DiscoveryDraft {
  return {
    questionnaireId: questionnaire.id,
    questionnaireVersion: questionnaire.version,
    answers: {},
  };
}

/**
 * Record one answer, immutably.
 *
 * ⚠️ Clearing a field REMOVES the key rather than storing an empty value. An
 * empty string recorded as an answer would raise the completeness of a profile
 * that is missing data — the exact failure ADR-0051's erratum exists to
 * prevent, and the reason the parser refuses empty values outright.
 */
export function applyDraftAnswer(
  draft: DiscoveryDraft,
  questionId: string,
  value: DiscoveryDraftValue,
): DiscoveryDraft {
  const cleaned = Array.isArray(value)
    ? value.map((entry) => entry.trim()).filter((entry) => entry !== '')
    : (value as string);

  const isEmpty = Array.isArray(cleaned) ? cleaned.length === 0 : cleaned.trim() === '';

  const answers = { ...draft.answers };
  if (isEmpty) {
    delete answers[questionId];
  } else {
    answers[questionId] = Array.isArray(cleaned) ? Object.freeze([...cleaned]) : cleaned;
  }

  return { ...draft, answers };
}

/**
 * Render the canonical Answer File.
 *
 * ⚠️ Deterministic: questions appear in QUESTIONNAIRE order, never in the order
 * the operator happened to fill them in, so re-saving an unchanged draft
 * produces byte-identical output. 🚫 No timestamp, no author, no id — nothing
 * that would make two saves of the same answers differ.
 */
export function renderAnswerFile(
  draft: DiscoveryDraft,
  questionnaire: BusinessDiscoveryQuestionnaire,
): string {
  const known = orderedQuestions(questionnaire)
    .filter((question) => draft.answers[question.id] !== undefined)
    .map((question) => ({ questionId: question.id, value: draft.answers[question.id] }));

  /**
   * 🚫 An answer whose question is NOT in the questionnaire is written out, not
   * dropped — so the canonical parser refuses it by name. Filtering it here
   * would hide the operator's answer AND make the file look valid: a silently
   * discarded answer is the one failure this whole layer exists to prevent.
   */
  const unknown = Object.keys(draft.answers)
    .filter((questionId) => !orderedQuestions(questionnaire).some((q) => q.id === questionId))
    .sort()
    .map((questionId) => ({ questionId, value: draft.answers[questionId] }));

  const answers = [...known, ...unknown];

  return `${JSON.stringify(
    {
      questionnaireId: draft.questionnaireId,
      questionnaireVersion: draft.questionnaireVersion,
      answers,
    },
    undefined,
    2,
  )}\n`;
}

function orderedQuestions(
  questionnaire: BusinessDiscoveryQuestionnaire,
): readonly BusinessDiscoveryQuestionnaireQuestion[] {
  return questionnaire.sections.flatMap((section) => section.questions);
}

/** The outcome of checking a draft against the canonical parser. */
export type DraftValidation =
  | { readonly kind: 'valid' }
  | { readonly kind: 'refused'; readonly reason: string; readonly questionId?: string };

/**
 * Validate the draft the only honest way: render what would be written and
 * parse it with the function the CLI uses.
 *
 * ⚠️ This checks STRUCTURE, never truth. It cannot tell whether a human's
 * answer about their own business is correct (ADR-0054 §0.1c).
 */
export function validateDraft(
  draft: DiscoveryDraft,
  questionnaire: BusinessDiscoveryQuestionnaire,
): DraftValidation {
  try {
    parseDiscoveryAnswerFile(renderAnswerFile(draft, questionnaire), questionnaire);
    return { kind: 'valid' };
  } catch (error) {
    if (error instanceof DiscoveryAnswerFileError) {
      return { kind: 'refused', reason: error.message, questionId: error.questionId };
    }
    // 🚫 An unrecognised failure is not flattened with its message attached —
    // it could carry the business's own words out of the parser.
    return { kind: 'refused', reason: 'The draft could not be validated.' };
  }
}

/**
 * What has been answered — a MEASUREMENT of the form, not a score.
 *
 * 🚫 This is not `discoveryCompletenessScore` and must never be presented as
 * one. It counts fields the operator filled in; the intake score is computed
 * from the profile, downstream, by code that owns that meaning.
 */
export interface DiscoveryProgress {
  readonly answered: number;
  readonly total: number;
  readonly requiredAnswered: number;
  readonly requiredTotal: number;
  /** Required questions still unanswered, in questionnaire order. */
  readonly missingRequired: readonly BusinessDiscoveryQuestionnaireQuestion[];
}

export function summarizeDiscoveryProgress(
  draft: DiscoveryDraft,
  questionnaire: BusinessDiscoveryQuestionnaire,
): DiscoveryProgress {
  const questions = orderedQuestions(questionnaire);
  const answered = questions.filter((question) => draft.answers[question.id] !== undefined);
  const required = questions.filter((question) => question.required);
  const missingRequired = required.filter((question) => draft.answers[question.id] === undefined);

  return {
    answered: answered.length,
    total: questions.length,
    requiredAnswered: required.length - missingRequired.length,
    requiredTotal: required.length,
    missingRequired,
  };
}

/**
 * May the operator submit?
 *
 * ⚠️ Submitting is an explicit, human-initiated act (ADR-0057 D4 class 2).
 * Autosave is not — it preserves what the operator typed and initiates nothing.
 * 🚫 Nothing here may submit on the operator's behalf: no timer, no on-blur, no
 * submit-when-complete. That would be a system-initiated act, which is class 3
 * even though its effect is entirely internal.
 */
export function canSubmit(
  draft: DiscoveryDraft,
  questionnaire: BusinessDiscoveryQuestionnaire,
): boolean {
  return (
    summarizeDiscoveryProgress(draft, questionnaire).missingRequired.length === 0 &&
    validateDraft(draft, questionnaire).kind === 'valid'
  );
}

/**
 * Rebuild a draft from what a form submitted.
 *
 * 🚫 Values are taken as typed. This never splits a prose answer into several
 * entries and never infers a kind — the kind is declared on the QUESTION
 * (ADR-0050 D2, ADR-0051 D2/D3). A `list` question's entries are separated by
 * the operator, one per line, because they chose where the boundaries are.
 */
export function draftFromFormEntries(
  entries: Readonly<Record<string, string>>,
  questionnaire: BusinessDiscoveryQuestionnaire,
): DiscoveryDraft {
  return orderedQuestions(questionnaire).reduce((draft, question) => {
    const raw = entries[question.id];
    if (raw === undefined) {
      return draft;
    }

    return applyDraftAnswer(draft, question.id, isListQuestion(question) ? raw.split('\n') : raw);
  }, emptyDraft(questionnaire));
}

/** Render a drafted value back into what the form field should show. */
export function fieldValueOf(draft: DiscoveryDraft, questionId: string): string {
  const value = draft.answers[questionId];
  if (value === undefined) return '';
  return Array.isArray(value) ? value.join('\n') : (value as string);
}

/** Refusal raised when a stored draft cannot be accepted. */
export class DiscoveryDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryDraftError';
  }
}

/**
 * Read a stored draft.
 *
 * ⚠️ A stored draft is UNTRUSTED INPUT, re-validated on read — the same rule
 * the snapshot repository follows. 🚫 A draft that does not match the current
 * questionnaire is REFUSED, never migrated: silently re-pointing old answers at
 * changed questions would fabricate the operator's meaning.
 */
export function parseDiscoveryDraft(
  rawText: string,
  questionnaire: BusinessDiscoveryQuestionnaire,
): DiscoveryDraft {
  let document: unknown;
  try {
    document = JSON.parse(rawText) as unknown;
  } catch {
    // 🚫 The JSON parser's message is not surfaced: V8 quotes a window of the
    // source, and here that source is the business's own words.
    throw new DiscoveryDraftError('The saved draft is not valid JSON.');
  }

  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new DiscoveryDraftError('The saved draft is not a JSON object.');
  }

  const record = document as Record<string, unknown>;
  if (record.questionnaireId !== questionnaire.id) {
    throw new DiscoveryDraftError(
      'The saved draft was written against a different questionnaire and is refused rather than ' +
        'reinterpreted.',
    );
  }

  if (record.questionnaireVersion !== questionnaire.version) {
    throw new DiscoveryDraftError(
      `The saved draft was written against questionnaire version ` +
        `"${String(record.questionnaireVersion)}" but the current version is ` +
        `"${questionnaire.version}". Re-answer against the current questions rather than ` +
        'assuming they still mean the same thing.',
    );
  }

  const rawAnswers = record.answers;
  if (typeof rawAnswers !== 'object' || rawAnswers === null || Array.isArray(rawAnswers)) {
    throw new DiscoveryDraftError('The saved draft has no "answers" object.');
  }

  const questions = new Map(orderedQuestions(questionnaire).map((q) => [q.id, q]));
  const answers: Record<string, DiscoveryDraftValue> = {};

  for (const [questionId, value] of Object.entries(rawAnswers as Record<string, unknown>)) {
    const question = questions.get(questionId);
    if (question === undefined) {
      // 🚫 Refused, not dropped. A dropped answer would make the form look
      // emptier than the operator left it, and they would retype it.
      throw new DiscoveryDraftError(
        `The saved draft answers "${questionId}", which is not a question in this questionnaire.`,
      );
    }

    if (isListQuestion(question)) {
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
        throw new DiscoveryDraftError(
          `The saved draft holds a value for "${questionId}" that is not a list of strings.`,
        );
      }
      answers[questionId] = Object.freeze([...(value as readonly string[])]);
      continue;
    }

    if (typeof value !== 'string') {
      throw new DiscoveryDraftError(
        `The saved draft holds a value for "${questionId}" that is not text.`,
      );
    }
    answers[questionId] = value;
  }

  return {
    questionnaireId: questionnaire.id,
    questionnaireVersion: questionnaire.version,
    answers,
  };
}

/** Serialize a draft for storage. Deterministic, in questionnaire order. */
export function renderDiscoveryDraft(
  draft: DiscoveryDraft,
  questionnaire: BusinessDiscoveryQuestionnaire,
): string {
  const answers: Record<string, DiscoveryDraftValue> = {};
  for (const question of orderedQuestions(questionnaire)) {
    const value = draft.answers[question.id];
    if (value !== undefined) {
      answers[question.id] = value;
    }
  }

  return `${JSON.stringify(
    {
      questionnaireId: draft.questionnaireId,
      questionnaireVersion: draft.questionnaireVersion,
      answers,
    },
    undefined,
    2,
  )}\n`;
}
