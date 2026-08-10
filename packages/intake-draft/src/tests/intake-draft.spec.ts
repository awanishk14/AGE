import { STATED_ANSWER_PROVENANCE, type DiscoveryAnswer } from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import {
  DraftRecordingRefusedError,
  answerFor,
  draftAnswers,
  emptyIntakeDraft,
  intakeDraftSchema,
  recordAnswerInDraft,
} from '../index';

/**
 * ADR-0066 **D4** (§0.5) — the draft is where a `confirmed-from-source` answer
 * may live. ⚠️ Every fixture is DELIBERATELY FICTIONAL (ADR-0053 D3,
 * ADR-0065 D1).
 */

const STATED: DiscoveryAnswer = {
  questionId: 'bi-name',
  value: 'Fictional Kite Repairs',
  provenance: STATED_ANSWER_PROVENANCE,
};

const CONFIRMED: DiscoveryAnswer = {
  questionId: 'bi-model',
  value: 'We repair kites for coastal schools.',
  provenance: {
    kind: 'confirmed-from-source',
    sourceId: 'src-fictional-brief',
    locator: 'Fictional onboarding brief (lines 4–6)',
    confirmedBy: 'operator:fictional',
  },
};

describe('the intake draft holds answers and their provenance', () => {
  it('starts empty, and an empty draft is a record with nothing in it', () => {
    const draft = emptyIntakeDraft();

    expect(draftAnswers(draft)).toEqual([]);
    expect(intakeDraftSchema.safeParse(draft).success).toBe(true);
  });

  it('records a `confirmed-from-source` answer with its provenance intact', () => {
    // ⚠️ THE POINT OF THE SLICE. The Answer File structurally cannot hold this
    // answer — its parser hard-codes `stated` — so before D4 there was nowhere
    // for an accepted passage to go.
    const draft = recordAnswerInDraft(emptyIntakeDraft(), CONFIRMED);

    expect(answerFor(draft, 'bi-model')?.provenance).toEqual({
      kind: 'confirmed-from-source',
      sourceId: 'src-fictional-brief',
      locator: 'Fictional onboarding brief (lines 4–6)',
      confirmedBy: 'operator:fictional',
    });
  });

  it('holds stated and confirmed answers side by side, each keeping its own origin', () => {
    const draft = recordAnswerInDraft(recordAnswerInDraft(emptyIntakeDraft(), STATED), CONFIRMED);

    expect(draftAnswers(draft)).toHaveLength(2);
    expect(answerFor(draft, 'bi-name')?.provenance.kind).toBe('stated');
    expect(answerFor(draft, 'bi-model')?.provenance.kind).toBe('confirmed-from-source');
  });

  it('🚫 never mutates the draft it was given', () => {
    // ⚠️ A caller that refuses the result must have changed nothing — otherwise
    // a rejected acceptance still edits the operator's record.
    const before = recordAnswerInDraft(emptyIntakeDraft(), STATED);
    const after = recordAnswerInDraft(before, CONFIRMED);

    expect(draftAnswers(before)).toHaveLength(1);
    expect(draftAnswers(after)).toHaveLength(2);
    expect(after).not.toBe(before);
  });

  it('🚫 refuses a second answer for the same question rather than overwriting it', () => {
    // ⚠️ An overwrite would discard the ORIGIN of the answer already accepted —
    // including a `confirmed-from-source` record whose completeness ADR-0066 D3
    // just guaranteed. Replacement is a real decision and belongs to its own
    // slice.
    const draft = recordAnswerInDraft(emptyIntakeDraft(), CONFIRMED);
    const again = () =>
      recordAnswerInDraft(draft, { ...CONFIRMED, value: 'Something else entirely.' });

    expect(again).toThrow(DraftRecordingRefusedError);
    expect(again).toThrow('already has an answer');
    expect(answerFor(draft, 'bi-model')?.value).toBe('We repair kites for coastal schools.');
  });

  it('🚫 refuses a malformed answer instead of carrying it towards the profile', () => {
    const malformed = { questionId: 'bi-name', value: 'x' } as unknown as DiscoveryAnswer;

    expect(() => recordAnswerInDraft(emptyIntakeDraft(), malformed)).toThrow(
      DraftRecordingRefusedError,
    );
  });

  it('🚫 a refusal names the question and never echoes the answer or the source', () => {
    // ⚠️ ADR-0065 D1 — a name in prose is client data. ADR-0054 D3's rule: name
    // a position, never contents.
    const draft = recordAnswerInDraft(emptyIntakeDraft(), CONFIRMED);

    let message = '';
    try {
      recordAnswerInDraft(draft, CONFIRMED);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('bi-model');
    expect(message).not.toContain('kites');
    expect(message).not.toContain('src-fictional-brief');
    expect(message).not.toContain('operator:fictional');
  });

  it('hands the canonical path plain answers, so it cannot tell a draft was involved', () => {
    // ⚠️ `draftAnswers` is the acceptance path's ONLY door (§0.5a). It returns
    // the same `DiscoveryAnswer[]` the Answer File yields — no draft type
    // escapes into scoring.
    const draft = recordAnswerInDraft(recordAnswerInDraft(emptyIntakeDraft(), STATED), CONFIRMED);
    const answers = draftAnswers(draft);

    expect(answers).toEqual([STATED, CONFIRMED]);
    expect(answerFor(draft, 'nothing-recorded-here')).toBeUndefined();
  });
});
