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
  emptyIntakeDraft,
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
 * ⚠️ THE HONEST NAME FOR WHAT HAPPENED TO THE RECORDED ANSWER. It is a single
 * literal rather than a union, so that widening it is a visible edit in a file
 * that says an ADR is required first — 🚫 do not add a `'stored'` arm here to
 * make a screen read better.
 */
export const DRAFT_STORAGE_STATE = 'not-stored' as const;

export type DraftStorageState = typeof DRAFT_STORAGE_STATE;

/** The sentence a surface shows about storage. ⚠️ Never blank, never implied. */
export function describeDraftStorage(): string {
  return (
    'This acceptance is held for this session only — AGE has not stored it. Where a draft is ' +
    'kept durably is a decision that has not been made yet, so nothing was written to disk or ' +
    'to a database. The answer file is unchanged.'
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
      storage: DRAFT_STORAGE_STATE,
    };
  } catch (error) {
    if (error instanceof DraftRecordingRefusedError) {
      return { kind: 'refused', questionId: error.questionId, reason: error.message };
    }
    throw error;
  }
}

export interface RecordPassageForQuestionOptions {
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
 * ⚠️ **THE DRAFT IT RECORDS INTO IS EMPTY, AND THAT IS THE HONEST SHAPE TODAY.**
 * `@age/intake-draft` persists nothing, so there is no draft to carry from one
 * request to the next. 🚫 Do not "fix" that here by writing a file: durable
 * draft storage is a separate decision (ADR-0066 §0.5a), and schema/migration/
 * RLS is independently a §3 stop condition. A surface must therefore report the
 * result as `not-stored` rather than implying a save.
 *
 * 🚫 An unknown question is REFUSED, never matched to the nearest one — an
 * acceptance recorded against a question AGE invented would point a real
 * human's confirmation at something they never confirmed.
 */
export function recordPassageForQuestion(
  options: RecordPassageForQuestionOptions,
): SourceAcceptanceOutcome {
  const { questionnaire, questionId, passage, source, confirmedBy } = options;

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
    draft: emptyIntakeDraft(),
    question,
    passage,
    source,
    confirmedBy,
  });
}
