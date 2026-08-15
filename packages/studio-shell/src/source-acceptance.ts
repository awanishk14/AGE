import {
  PassageAcceptanceRefusedError,
  acceptPassageAsAnswer,
  type SourceDocument,
  type SourcePassage,
} from '@age/assisted-intake';
import type {
  BusinessDiscoveryQuestionnaire,
  BusinessDiscoveryQuestionnaireQuestion,
  DiscoveryAnswer,
} from '@age/business-discovery-contracts';
import {
  DraftRecordingRefusedError,
  recordAnswerInDraft,
  type IntakeDraft,
} from '@age/intake-draft';

/**
 * ADR-0066 **D4 as clarified** (§0.5a), slice 4 — the ONE place where a passage
 * a human accepted becomes an answer that lands somewhere.
 *
 * ⚠️ **THIS IS A COMPOSITION, 🚫 NOT A NEW CAPABILITY.** It calls
 * `acceptPassageAsAnswer` (ADR-0059 D1's single acceptance path, which proves
 * the provenance complete under ADR-0066 D3) and then `recordAnswerInDraft`
 * (which refuses a duplicate rather than overwriting a recorded origin).
 * 🚫 Neither rule is restated here, and 🚫 neither may be bypassed by a second
 * route: `@age/assisted-intake` exports exactly two `accept*` names, and its own
 * guard asserts that, so the wiring lives here rather than there.
 *
 * 🛑 **THE DRAFT IS A WORKING ARTIFACT, 🚫 NEVER A SECOND CANONICAL SOURCE OF
 * TRUTH** (§0.5a). Nothing here writes, and 🚫 nothing here may learn how:
 * `@age/intake-draft` persists nothing, and durable draft storage is a
 * **separate decision** the Product Owner deliberately kept out of D4. The
 * `storage` field below exists so a screen can say that plainly instead of
 * implying a save that never happened.
 *
 * Pure: no clock, no id generation, no randomness, no I/O.
 */

/**
 * ⚠️ THE HONEST NAME FOR WHAT HAPPENED TO THE RECORDED ANSWER.
 *
 * ⚠️ **THE SECOND ARM ARRIVED WITH ADR-0073, 🚫 NOT WITH A SCREEN THAT READ
 * BETTER.** It was a single literal until the Product Owner fired ADR-0067's own
 * revisit trigger; that is the bar for a third arm too. 🚫 Do not add one to
 * describe something a caller merely intends to write.
 */
export const DRAFT_STORAGE_STATES = Object.freeze([
  /** Held for this request only — nothing was written anywhere. */
  'not-stored',
  /**
   * Written to the file the operator's own workspace holds (ADR-0073 D1).
   * 🚫 It does NOT mean AGE stored it, and the sentence below must not say so.
   */
  'workspace-file',
] as const);

export type DraftStorageState = (typeof DRAFT_STORAGE_STATES)[number];

/**
 * The sentence a surface shows about storage. ⚠️ Never blank, never implied.
 *
 * 🛑 **THIS SENTENCE IS THE OPERATOR'S ONLY ACCOUNT OF WHERE THEIR CONFIRMATION
 * WENT** (ADR-0073 D7). 🚫 No arm may say "saved to AGE", "synced", "uploaded" or
 * "shared" — the file is on their own machine and AGE holds nothing — and
 * 🚫 "not stored" must never be printed for a write that happened.
 */
export function describeDraftStorage(state: DraftStorageState): string {
  if (state === 'not-stored') {
    return (
      'This acceptance is held for this request only — nothing was written. It will not be ' +
      'there when the page is reloaded, and the answer file is unchanged.'
    );
  }

  return (
    'This confirmation was written to the source-confirmation file in the discovery workspace ' +
    'you named, on this machine. AGE has not stored it anywhere else, nothing was sent, and the ' +
    'answer file is unchanged.'
  );
}

export type SourceAcceptanceOutcome =
  | {
      readonly kind: 'refused';
      readonly questionId: string;
      /** ⚠️ Already written to name a position, never the passage's words. */
      readonly reason: string;
    }
  | {
      readonly kind: 'recorded';
      readonly answer: DiscoveryAnswer;
      readonly draft: IntakeDraft;
      readonly storage: DraftStorageState;
    };

export interface RecordPassageInDraftOptions {
  /** The draft so far. Never mutated — a new draft is returned. */
  readonly draft: IntakeDraft;
  readonly question: BusinessDiscoveryQuestionnaireQuestion;
  /** Exactly one passage. 🚫 There is no bulk arm — ADR-0059 D1. */
  readonly passage: SourcePassage;
  readonly source: SourceDocument;
  /** Who accepted it. Required, never defaulted or inferred (ADR-0053 D4). */
  readonly confirmedBy: string;
}

/**
 * Records one human's acceptance of one passage in the working draft.
 *
 * 🚫 Refusals are RETURNED, never thrown past the caller and never downgraded:
 * an incomplete provenance is refused rather than recorded as `stated`
 * (ADR-0066 §0.4c), and a duplicate answer is refused rather than overwritten,
 * because an overwrite destroys a recorded origin.
 */
export function recordPassageInDraft(
  options: RecordPassageInDraftOptions,
): SourceAcceptanceOutcome {
  const { draft, question, passage, source, confirmedBy } = options;

  let answer: DiscoveryAnswer;
  try {
    answer = acceptPassageAsAnswer({ question, passage, source, confirmedBy });
  } catch (error) {
    if (error instanceof PassageAcceptanceRefusedError) {
      return { kind: 'refused', questionId: error.questionId, reason: error.message };
    }
    throw error;
  }

  try {
    return {
      kind: 'recorded',
      answer,
      draft: recordAnswerInDraft(draft, answer),
      // ⚠️ TRUE AT THIS POINT, and stated by the layer that knows it: this
      // module is pure and has written nothing. 🚫 It must not announce a write
      // some caller intends to perform — only the layer that performed one may
      // widen this, and only after it succeeded (ADR-0073 D7).
      storage: 'not-stored',
    };
  } catch (error) {
    if (error instanceof DraftRecordingRefusedError) {
      return { kind: 'refused', questionId: error.questionId, reason: error.message };
    }
    throw error;
  }
}

export interface RecordPassageForQuestionOptions {
  /**
   * The confirmations recorded so far (ADR-0073 D1).
   *
   * ⚠️ **REQUIRED, WITH NO DEFAULT.** It was `emptyIntakeDraft()` here until
   * ADR-0073, which is exactly why every earlier confirmation disappeared. 🚫 Do
   * not restore a default: a caller that forgets to load what is already
   * confirmed would silently start over, and the duplicate refusal — the one
   * guard that protects a recorded origin — would never fire.
   */
  readonly draft: IntakeDraft;
  readonly questionnaire: BusinessDiscoveryQuestionnaire;
  readonly questionId: string;
  readonly passage: SourcePassage;
  readonly source: SourceDocument;
  readonly confirmedBy: string;
}

/**
 * The same acceptance, addressed by question id — what a surface has after a
 * human picked a question from a list.
 *
 * ⚠️ **THE DRAFT IS SUPPLIED BY THE CALLER (ADR-0073 D1).** `@age/intake-draft`
 * still persists nothing and 🚫 must not learn how; the reading and writing live
 * one layer out, in the operator-workspace orchestration and the console's single
 * effect module. What changed is that the caller now has somewhere to load a
 * draft *from* — the operator's own workspace — so a second confirmation no
 * longer starts from nothing. 🚫 Option 3 (a tenant-scoped table) stays refused.
 *
 * 🚫 An unknown question is REFUSED, never matched to the nearest one — an
 * acceptance recorded against a question AGE invented would point a real
 * human's confirmation at something they never confirmed.
 */
export function recordPassageForQuestion(
  options: RecordPassageForQuestionOptions,
): SourceAcceptanceOutcome {
  const { draft, questionnaire, questionId, passage, source, confirmedBy } = options;

  const question = questionnaire.sections
    .flatMap((section) => section.questions)
    .find((candidate) => candidate.id === questionId);

  if (question === undefined) {
    return {
      kind: 'refused',
      questionId,
      reason:
        'That question is not part of the discovery questionnaire, so no answer was recorded ' +
        'against it. AGE refuses rather than choosing the closest question.',
    };
  }

  return recordPassageInDraft({
    draft,
    question,
    passage,
    source,
    confirmedBy,
  });
}
