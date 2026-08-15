import {
  discoveryAnswerSchema,
  type BusinessDiscoveryQuestionnaire,
  type BusinessDiscoveryQuestionnaireQuestion,
  type DiscoveryAnswer,
} from '@age/business-discovery-contracts';

import { isListQuestion } from './discovery-draft';

/**
 * ADR-0073 D1/D2 — the file where the answers a human confirmed **from a source**
 * survive between requests.
 *
 * ⚠️ **THIS IS NOT THE ANSWER FILE AND MUST NEVER BECOME IT** (D2). The Answer
 * File is hand-authored and stays `stated`-only, because provenance recorded in a
 * file anyone can type is a **claim**, not a record. This file exists only
 * because its entries can be produced by the acceptance path — and it therefore
 * accepts `confirmed-from-source` provenance and 🚫 **nothing else**.
 *
 * 🛑 **A `stated` ENTRY HERE IS REFUSED, 🚫 NEVER DOWNGRADED, RE-LABELLED OR
 * DROPPED.** Downgrading would launder a typed claim into a confirmation;
 * dropping would make the file look shorter than the operator left it. The two
 * intake channels stay two channels (D2).
 *
 * ⚠️ **THE FILE IS HAND-EDITABLE, AND THAT IS THE HONEST LIMIT OF OPTION 2**, not
 * a defect this module may compensate for. What it can do is refuse anything that
 * is not shaped like something the acceptance path produced. What it cannot do is
 * prove a human really confirmed it. 🚫 Do not add a signature, a checksum or a
 * "verified" flag to imply otherwise.
 *
 * ⚠️ Read entries are **UNTRUSTED INPUT**, re-validated here — the same rule the
 * snapshot repository and the discovery draft already follow.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/** Refusal raised when a stored source-confirmed file cannot be accepted. */
export class SourceConfirmedAnswersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceConfirmedAnswersError';
  }
}

function orderedQuestions(
  questionnaire: BusinessDiscoveryQuestionnaire,
): readonly BusinessDiscoveryQuestionnaireQuestion[] {
  return questionnaire.sections.flatMap((section) => section.questions);
}

/**
 * Read the stored confirmations.
 *
 * 🚫 Every failure REFUSES rather than returning what could be salvaged. A file
 * that is half-read renders as a business with fewer confirmations than the
 * operator made, which is indistinguishable on screen from work they never did.
 */
export function parseSourceConfirmedAnswers(
  rawText: string,
  questionnaire: BusinessDiscoveryQuestionnaire,
): readonly DiscoveryAnswer[] {
  let document: unknown;
  try {
    document = JSON.parse(rawText) as unknown;
  } catch {
    // 🚫 The JSON parser's message is not surfaced: V8 quotes a window of the
    // source, and here that source is the business's own words.
    throw new SourceConfirmedAnswersError('The saved source confirmations are not valid JSON.');
  }

  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new SourceConfirmedAnswersError('The saved source confirmations are not a JSON object.');
  }

  const record = document as Record<string, unknown>;

  if (record.questionnaireId !== questionnaire.id) {
    throw new SourceConfirmedAnswersError(
      'The saved source confirmations were written against a different questionnaire and are ' +
        'refused rather than reinterpreted.',
    );
  }

  if (record.questionnaireVersion !== questionnaire.version) {
    throw new SourceConfirmedAnswersError(
      `The saved source confirmations were written against questionnaire version ` +
        `"${String(record.questionnaireVersion)}" but the current version is ` +
        `"${questionnaire.version}". Confirm against the current questions rather than assuming ` +
        'they still mean the same thing.',
    );
  }

  const rawAnswers = record.answers;
  if (!Array.isArray(rawAnswers)) {
    throw new SourceConfirmedAnswersError('The saved source confirmations have no "answers" list.');
  }

  const questions = new Map(
    orderedQuestions(questionnaire).map((question) => [question.id, question]),
  );
  const seen = new Set<string>();
  const answers: DiscoveryAnswer[] = [];

  for (const entry of rawAnswers as readonly unknown[]) {
    const parsed = discoveryAnswerSchema.safeParse(entry);
    if (!parsed.success) {
      // 🚫 The validator's issue list is not surfaced: it echoes the offending
      // values, which are the business's own words.
      throw new SourceConfirmedAnswersError(
        'The saved source confirmations hold an entry that is not a valid discovery answer.',
      );
    }

    const answer = parsed.data as DiscoveryAnswer;

    // 🛑 D2 — the one rule this file exists to keep.
    if (answer.provenance.kind !== 'confirmed-from-source') {
      throw new SourceConfirmedAnswersError(
        `The saved source confirmations hold an entry for "${answer.questionId}" that does not ` +
          'record a confirmation from a source. It is refused rather than relabelled: an answer ' +
          'that was typed belongs in the answer file, not here.',
      );
    }

    const question = questions.get(answer.questionId);
    if (question === undefined) {
      throw new SourceConfirmedAnswersError(
        `The saved source confirmations answer "${answer.questionId}", which is not a question in ` +
          'this questionnaire.',
      );
    }

    if (isListQuestion(question) !== Array.isArray(answer.value)) {
      throw new SourceConfirmedAnswersError(
        `The saved source confirmations hold a value for "${answer.questionId}" whose shape does ` +
          'not match the question. The kind is declared on the question and is never inferred ' +
          'from the value.',
      );
    }

    // ⚠️ The same rule as `recordAnswerInDraft`, applied to a file a human may
    // have edited. 🚫 Neither entry wins — picking one would discard a recorded
    // origin, which is the single thing this file exists to keep.
    if (seen.has(answer.questionId)) {
      throw new SourceConfirmedAnswersError(
        `The saved source confirmations hold two answers for "${answer.questionId}". Neither is ` +
          'chosen over the other, because choosing would discard a recorded confirmation.',
      );
    }

    seen.add(answer.questionId);
    answers.push(answer);
  }

  return Object.freeze(answers);
}

/**
 * Serialize the confirmations.
 *
 * ⚠️ Written in ACCEPTANCE ORDER, which is the operator's own sequence — 🚫 it
 * carries no meaning downstream and nothing may read it as recency or priority.
 * Re-writing an unchanged list therefore produces byte-identical output.
 *
 * 🚫 No timestamp and no author line: who confirmed each answer is already on
 * that answer's provenance, and a second, file-level author would be a claim
 * about entries it did not produce.
 */
export function renderSourceConfirmedAnswers(
  answers: readonly DiscoveryAnswer[],
  questionnaire: BusinessDiscoveryQuestionnaire,
): string {
  return `${JSON.stringify(
    {
      questionnaireId: questionnaire.id,
      questionnaireVersion: questionnaire.version,
      answers,
    },
    undefined,
    2,
  )}\n`;
}
