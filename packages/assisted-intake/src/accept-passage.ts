import type {
  BusinessDiscoveryQuestionnaireQuestion,
  DiscoveryAnswer,
} from '@age/business-discovery-contracts';

import type { SourceDocument } from './source-document';
import type { SourcePassage } from './source-passage';

/**
 * ADR-0059 **D1 + D2** — the ONE path from a proposed passage to an answer, and
 * it runs once per answer, for one named human.
 *
 * 🚫 **THERE IS NO "ACCEPT ALL", AND THERE MUST NEVER BE ONE.** D1 is explicit,
 * and so is its reasoning: the tedium being complained about is the same force
 * that would make bulk review a formality. 🚫 No function here takes a list of
 * passages, and 🚫 none returns a list of answers — the signature is the
 * enforcement, because a helper that loops is trivial to add and impossible to
 * notice in review.
 *
 * 🚫 **THERE IS NO CONFIDENCE THRESHOLD** — "accept everything above X" is an
 * inference about inferences (D1), and there is no X in this package to compare
 * against anyway (D3).
 *
 * ⚠️ The accepted answer's value is the passage's text **verbatim**. This layer
 * TRANSCRIBES and never INFERS (ADR-0050 D2): it does not summarise, re-case,
 * re-punctuate, or split one passage across several answers.
 *
 * Pure: no clock, no id generation, no randomness, no I/O.
 */

/** Refusal raised when a passage cannot become an answer. */
export class PassageAcceptanceRefusedError extends Error {
  /** The question the acceptance was aimed at. */
  readonly questionId: string;

  constructor(message: string, questionId: string) {
    super(message);
    this.name = 'PassageAcceptanceRefusedError';
    this.questionId = questionId;
  }
}

export interface AcceptPassageAsAnswerOptions {
  /** The question this passage is being accepted AS the answer to. */
  readonly question: BusinessDiscoveryQuestionnaireQuestion;
  /** The passage the human chose. Exactly one — see the module note. */
  readonly passage: SourcePassage;
  /** The document the passage came from, so the answer can point back to it. */
  readonly source: SourceDocument;
  /**
   * Who accepted it. Required, never defaulted, generated or inferred
   * (ADR-0053 D4), and it decides nothing — it records who acted.
   */
  readonly confirmedBy: string;
}

/**
 * Turns one human's acceptance of one passage into one discovery answer.
 *
 * @throws {PassageAcceptanceRefusedError} if the passage cannot honestly become
 *         this question's answer, naming the question id but 🚫 never echoing
 *         the passage text — a refusal must not carry a real business's words
 *         into a log (ADR-0054 D1's rule, applied here).
 */
export function acceptPassageAsAnswer(options: AcceptPassageAsAnswerOptions): DiscoveryAnswer {
  const { question, passage, source, confirmedBy } = options;

  if (confirmedBy.trim() === '') {
    throw new PassageAcceptanceRefusedError(
      `Question "${question.id}" cannot record an acceptance with no accepting person. A ` +
        '`confirmed-from-source` answer whose acceptor is unknown is indistinguishable from an ' +
        'answer nobody ever reviewed, which is the one thing this path exists to prevent.',
      question.id,
    );
  }

  if (passage.text.trim() === '') {
    throw new PassageAcceptanceRefusedError(
      `Question "${question.id}" was given an empty passage. An empty acceptance would record ` +
        'that a human confirmed something, while recording nothing they confirmed.',
      question.id,
    );
  }

  if (question.kind === 'choice') {
    // 🚫 REFUSED, not "matched to the nearest choice". ADR-0051: the enum is on
    // the QUESTION, never on the answer, and picking which declared choice a
    // paragraph of prose "means" is exactly the inference ADR-0050 D2 forbids.
    // The operator selects a choice themselves; a document cannot select it for
    // them, however clearly it seems to say so.
    throw new PassageAcceptanceRefusedError(
      `Question "${question.id}" is answered by choosing one of its declared choices, so it ` +
        'cannot be answered from a document passage. Deciding which choice a passage means ' +
        'would be AGE inferring an answer rather than transcribing one.',
      question.id,
    );
  }

  // ⚠️ A list question gains ONE entry per acceptance. Splitting a passage into
  // several entries would be inference (ADR-0050 D2); accepting several
  // passages is several acceptances, which is the point.
  const value: string | readonly string[] =
    question.kind === 'list' ? Object.freeze([passage.text]) : passage.text;

  return Object.freeze({
    questionId: question.id,
    value,
    provenance: Object.freeze({
      kind: 'confirmed-from-source' as const,
      sourceId: source.sourceId,
      // ⚠️ The document's LABEL, 🚫 never its `locator`. The locator of a route-1
      // source is an absolute path on the operator's machine, and the answer it
      // produces travels further than the machine does. The label plus the
      // passage's position is what a human needs to check the claim.
      locator: `${source.label} (${passage.locator})`,
      confirmedBy,
    }),
  });
}
