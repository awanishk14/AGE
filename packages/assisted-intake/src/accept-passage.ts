import {
  confirmedFromSourceAnswerProvenanceSchema,
  type BusinessDiscoveryQuestionnaireQuestion,
  type ConfirmedFromSourceAnswerProvenance,
  type DiscoveryAnswer,
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
 * ADR-0066 **D3** (accepted 2026-08-10, §0.4) — the completeness rule, enforced
 * where an answer enters.
 *
 * > A source-confirmed answer is valid only when its provenance is complete
 * > enough to identify the source, locate the originating material, and identify
 * > the confirmer.
 *
 * 🚫 **THE REFUSAL IS THE POINT, AND THE DOWNGRADE IS WHAT IT REFUSES.** An
 * incomplete provenance must 🚫 never fall back to `STATED_ANSWER_PROVENANCE`,
 * 🚫 never be repaired with a placeholder, and 🚫 never be inferred from
 * anything else on the passage. `stated` means *"the client told AGE this"*;
 * silently turning a source-confirmed answer into one **rewrites the history of
 * how the fact entered AGE**, and nothing downstream can detect it afterwards
 * (§0.4c). Refusing is loud and fixable; downgrading is quiet and permanent.
 *
 * ⚠️ **WHY THE COMPONENTS ARE CHECKED AND NOT ONLY THE SCHEMA.** `locator` is
 * composed here as `label (passage locator)`, so an empty `label` still yields a
 * NON-EMPTY string that satisfies `.min(1)` while locating nothing. Parsing the
 * composed value alone would report compliance for a provenance that cannot take
 * a human back to the sentence — the exact failure D3 exists to prevent. Both
 * checks run: the components, then the composed value against the shared schema,
 * so this can never drift from `answer-provenance.ts`'s definition of complete.
 *
 * 🚫 **THE MESSAGE NAMES THE FIELD, NEVER ITS VALUE.** A `sourceId` or `label`
 * is operator-supplied and routinely carries a real business's name, and a name
 * in prose is client data (ADR-0065 D1). It names a position, never contents —
 * the same rule ADR-0054 D3 applies to record refusals.
 */
function assertProvenanceIsComplete(
  provenance: ConfirmedFromSourceAnswerProvenance,
  questionId: string,
  components: {
    readonly sourceId: string;
    readonly label: string;
    readonly passageLocator: string;
  },
): void {
  // ⚠️ WRITTEN OUT RATHER THAN LOOPED, DELIBERATELY. `refusals.spec.ts` asserts
  // this module contains no `.map(`, `.forEach(` or `for (` — ADR-0059 D1's "no
  // bulk acceptance" guard, which reads the source rather than the exports
  // because a loop is trivial to add and invisible in review. 🚫 Do not relax
  // that guard to tidy these four lines: the guard protects a decision, and this
  // is only a list of four names.
  const missing: string[] = [];
  if (components.sourceId.trim() === '') missing.push('sourceId');
  if (components.label.trim() === '') missing.push('the source label');
  if (components.passageLocator.trim() === '') missing.push('the passage locator');
  if (provenance.confirmedBy.trim() === '') missing.push('confirmedBy');

  if (missing.length > 0) {
    throw new PassageAcceptanceRefusedError(
      `Question "${questionId}" cannot record a source-confirmed answer: its provenance is ` +
        `incomplete (${missing.join(', ')}). A source-confirmed answer is valid only when its ` +
        'provenance can identify the source, locate the originating material, and identify the ' +
        'confirmer. AGE refuses the answer rather than recording it as stated, because a ' +
        'downgrade would change how the fact is recorded to have entered AGE.',
      questionId,
    );
  }

  // ⚠️ The shared schema is the definition of complete, so it is applied rather
  // than re-stated. If `answer-provenance.ts` tightens D3's requirements, this
  // boundary tightens with it and 🚫 cannot silently fall behind.
  if (!confirmedFromSourceAnswerProvenanceSchema.safeParse(provenance).success) {
    throw new PassageAcceptanceRefusedError(
      `Question "${questionId}" produced a provenance that is not a valid ` +
        '`confirmed-from-source` record. AGE refuses the answer rather than recording it as ' +
        'stated.',
      questionId,
    );
  }
}

/**
 * Turns one human's acceptance of one passage into one discovery answer.
 *
 * @throws {PassageAcceptanceRefusedError} if the passage cannot honestly become
 *         this question's answer, or if its provenance would be incomplete
 *         (ADR-0066 D3). It names the question id but 🚫 never echoes the
 *         passage text — a refusal must not carry a real business's words into a
 *         log (ADR-0054 D1's rule, applied here).
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

  const provenance = Object.freeze({
    kind: 'confirmed-from-source' as const,
    sourceId: source.sourceId,
    // ⚠️ The document's LABEL, 🚫 never its `locator`. The locator of a route-1
    // source is an absolute path on the operator's machine, and the answer it
    // produces travels further than the machine does. The label plus the
    // passage's position is what a human needs to check the claim.
    locator: `${source.label} (${passage.locator})`,
    confirmedBy,
  });

  assertProvenanceIsComplete(provenance, question.id, {
    sourceId: source.sourceId,
    label: source.label,
    passageLocator: passage.locator,
  });

  return Object.freeze({
    questionId: question.id,
    value,
    provenance,
  });
}
