import { z } from 'zod';

import { discoveryAnswerSchema, type DiscoveryAnswer } from '@age/business-discovery-contracts';

/**
 * ADR-0066 **D4** (accepted 2026-08-10, §0.5) — the durable home for a
 * confirmed answer is the **draft**, not the Answer File.
 *
 * 🛑 **THE OWNER'S CLARIFICATION IS PART OF THE DECISION (§0.5a): THE DRAFT IS
 * NOT A SECOND CANONICAL SOURCE OF TRUTH.** It is an intake/**working**
 * artifact. The canonical profile and BIF are produced from its answers by the
 * existing, explicit path — `buildProfileFromAnswers` and
 * `produceScoredBifContext` — 🚫 never from the draft itself.
 *
 * 🚫 **`Draft → everything` IS THE FAILURE THIS PACKAGE EXISTS TO PREVENT**, and
 * it arrives by drift, never by decision: a reader that finds the draft closer
 * than the Answer File, a screen that renders it because it is richer, a
 * capability that takes it because it is already loaded. Each is locally
 * reasonable; the sum is a shadow database nobody chose. The guard is structural
 * — `draft-is-not-canonical.spec.ts` asserts no scoring, BIF, capability or
 * persistence module imports this package, and `answerFor`/`draftAnswers` return
 * plain `DiscoveryAnswer`s so a consumer holds **answers**, not a draft.
 *
 * ⚠️ **WHY PROVENANCE CANNOT LIVE IN THE ANSWER FILE** (§0.5a): that file is
 * hand-edited, so provenance recorded there would be a **claim anyone can
 * type**. Here it can only arrive on an answer the acceptance path produced —
 * and ADR-0066 D3 already refuses an incomplete one. Provenance is a record of
 * something that happened, 🚫 never an assertion someone wrote down.
 *
 * 🚫 **THIS PACKAGE PERSISTS NOTHING, AND MUST NOT LEARN HOW.** The durable
 * storage mechanism is a **separate decision** the owner refused to let D4
 * absorb; it needs its own `Proposed` ADR when a slice actually requires it, and
 * schema/migration/RLS is independently a §3 stop condition. `purity.spec.ts`
 * enforces this by reading the source.
 *
 * ⚠️ **AGE-INV-PROV-1 STILL HOLDS THROUGH THE DRAFT** (ADR-0066 §0.3c): the same
 * answers scored via a draft produce byte-identical results whether they arrived
 * `stated` or `confirmed-from-source`. The draft is where provenance may *live*;
 * it is 🚫 not a place where provenance may start to *count*.
 *
 * Pure: no clock, no id generation, no randomness, no I/O.
 */

/** An operator's working intake record. 🚫 Never a canonical source of truth. */
export interface IntakeDraft {
  /**
   * The accepted answers, in acceptance order. ⚠️ Order is the operator's own
   * sequence and carries no meaning for scoring — nothing downstream may read it
   * as recency, priority or confidence.
   */
  readonly answers: readonly DiscoveryAnswer[];
}

export const intakeDraftSchema = z.object({
  answers: z.array(discoveryAnswerSchema),
});

/** Refusal raised when an answer cannot be recorded in a draft. */
export class DraftRecordingRefusedError extends Error {
  /** The question the recording was aimed at. */
  readonly questionId: string;

  constructor(message: string, questionId: string) {
    super(message);
    this.name = 'DraftRecordingRefusedError';
    this.questionId = questionId;
  }
}

/** A draft holding nothing. 🚫 Not "an empty business" — an empty *record*. */
export function emptyIntakeDraft(): IntakeDraft {
  return Object.freeze({ answers: Object.freeze([]) });
}

/**
 * Records one answer, returning a **new** draft. The input draft is never
 * mutated, so a caller that refuses the result has changed nothing.
 *
 * 🚫 **A SECOND ANSWER FOR THE SAME QUESTION IS REFUSED, NOT OVERWRITTEN.**
 * Silently replacing one would destroy the provenance of the answer already
 * there — including, in the mixed case, a `confirmed-from-source` record whose
 * completeness ADR-0066 D3 just finished guaranteeing. Replacement is a real
 * decision (what happens to the displaced answer's origin?) and it belongs to
 * the slice that needs it, with its own ADR.
 *
 * @throws {DraftRecordingRefusedError} naming the question id and 🚫 never
 *         echoing a value, a source's contents or an organization id
 *         (ADR-0054 D3, ADR-0065 D1).
 */
export function recordAnswerInDraft(draft: IntakeDraft, answer: DiscoveryAnswer): IntakeDraft {
  const parsed = discoveryAnswerSchema.safeParse(answer);

  if (!parsed.success) {
    throw new DraftRecordingRefusedError(
      `Question "${answer.questionId}" produced an answer that is not a valid discovery answer, ` +
        'so it cannot be recorded. A draft that accepted a malformed answer would carry it into ' +
        'the profile, where the shape is assumed rather than checked.',
      answer.questionId,
    );
  }

  if (answerFor(draft, answer.questionId) !== undefined) {
    throw new DraftRecordingRefusedError(
      `Question "${answer.questionId}" already has an answer in this draft. Replacing it would ` +
        'discard the recorded origin of the answer already accepted, which is the one thing a ' +
        'draft exists to keep. Replacement is a separate decision, not a silent overwrite.',
      answer.questionId,
    );
  }

  return Object.freeze({ answers: Object.freeze([...draft.answers, answer]) });
}

/** The answer recorded for a question, or `undefined` if there is none. */
export function answerFor(draft: IntakeDraft, questionId: string): DiscoveryAnswer | undefined {
  return draft.answers.find((answer) => answer.questionId === questionId);
}

/**
 * The explicit hand-off: the draft's answers, for the canonical path
 * (`buildProfileFromAnswers` → `produceScoredBifContext`) to consume.
 *
 * ⚠️ **THIS FUNCTION IS THE ACCEPTANCE PATH'S DOOR, AND IT IS DELIBERATELY THE
 * ONLY ONE.** It returns `DiscoveryAnswer`s — the same type the Answer File
 * yields — so the canonical path cannot tell, and must not care, that a draft
 * was involved. 🚫 Do not add a variant that returns the draft itself to a
 * scorer, a BIF mapper or a capability: that is the first step of
 * `Draft → everything` (§0.5a).
 */
export function draftAnswers(draft: IntakeDraft): readonly DiscoveryAnswer[] {
  return draft.answers;
}
