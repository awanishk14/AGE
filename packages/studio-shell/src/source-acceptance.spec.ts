import type { SourceDocument, SourcePassage } from '@age/assisted-intake';
import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  type BusinessDiscoveryQuestionnaireQuestion,
} from '@age/business-discovery-contracts';
import { emptyIntakeDraft } from '@age/intake-draft';
import { describe, expect, it } from 'vitest';

import {
  DRAFT_STORAGE_STATES,
  describeDraftStorage,
  recordPassageForQuestion,
  recordPassageInDraft,
} from './source-acceptance';

/**
 * ⚠️ Fixtures are OBVIOUSLY FICTIONAL, deliberately (ADR-0053 D3, ADR-0065 D1):
 * a real business's name in prose is client data, and obvious fictionality is
 * the guard. 🚫 Do not "make these more realistic".
 */
const QUESTION: BusinessDiscoveryQuestionnaireQuestion = {
  id: 'bi-model',
  sectionId: 'business-identity',
  prompt: 'How does the business make money?',
  required: true,
  critical: true,
  kind: 'text',
};

const LIST_QUESTION: BusinessDiscoveryQuestionnaireQuestion = {
  id: 'of-products',
  sectionId: 'offerings',
  prompt: 'List the products the business sells.',
  required: false,
  critical: false,
  kind: 'list',
};

const CHOICE_QUESTION: BusinessDiscoveryQuestionnaireQuestion = {
  id: 'bi-stage',
  sectionId: 'business-identity',
  prompt: 'What stage is the business at?',
  required: false,
  critical: false,
  kind: 'choice',
  choices: ['early', 'established'],
};

const SOURCE: SourceDocument = {
  sourceId: 'src-fictional-brief',
  label: 'Fictional Kite Repairs brief',
  kind: 'plain-text',
  locator: 'E:/fictional-operator-files/brief.txt',
  text: 'Fictional Kite Repairs charges per repair.',
};

const PASSAGE: SourcePassage = {
  passageId: 'src-fictional-brief#1',
  locator: 'line 3',
  text: 'Fictional Kite Repairs charges per repair.',
};

const CONFIRMED_BY = 'operator:fictional';

describe('recordPassageInDraft', () => {
  it('records the passage verbatim, with a complete confirmed-from-source provenance', () => {
    const outcome = recordPassageInDraft({
      draft: emptyIntakeDraft(),
      question: QUESTION,
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });

    expect(outcome.kind).toBe('recorded');
    if (outcome.kind !== 'recorded') return;

    expect(outcome.answer.value).toBe(PASSAGE.text);
    expect(outcome.answer.provenance).toEqual({
      kind: 'confirmed-from-source',
      sourceId: 'src-fictional-brief',
      locator: 'Fictional Kite Repairs brief (line 3)',
      confirmedBy: CONFIRMED_BY,
    });
    expect(outcome.draft.answers).toHaveLength(1);
  });

  it('a list question gains exactly ONE entry per acceptance', () => {
    const outcome = recordPassageInDraft({
      draft: emptyIntakeDraft(),
      question: LIST_QUESTION,
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });

    expect(outcome.kind).toBe('recorded');
    if (outcome.kind !== 'recorded') return;
    expect(outcome.answer.value).toEqual([PASSAGE.text]);
  });

  /**
   * 🛑 ADR-0066 §0.5a — the acceptance is held for this request and 🚫 nothing
   * is written. A screen that implied a save would be claiming a durable record
   * the Product Owner deliberately did not authorise.
   */
  it('says plainly that nothing was stored', () => {
    const outcome = recordPassageInDraft({
      draft: emptyIntakeDraft(),
      question: QUESTION,
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });

    expect(outcome.kind).toBe('recorded');
    if (outcome.kind !== 'recorded') return;

    // 🛑 The PURE layer always says `not-stored`, because it has written
    // nothing. ⚠️ Only the layer that completed a write may widen this
    // (ADR-0073 D7) — a caller that merely INTENDS to write must not.
    expect(outcome.storage).toBe('not-stored');
    expect(describeDraftStorage('not-stored')).toContain('nothing was written');
    expect(describeDraftStorage('not-stored')).toContain('answer file is unchanged');
  });

  /**
   * 🚫 **NO ARM MAY CLAIM AGE STORED IT** (ADR-0073 D7). The file is on the
   * operator's own machine; "saved to AGE", "synced", "uploaded" or "shared"
   * would each tell them something that did not happen.
   */
  it('🚫 no storage sentence claims AGE stored, sent or shared the confirmation', () => {
    expect(DRAFT_STORAGE_STATES).toEqual(['not-stored', 'workspace-file']);

    for (const state of DRAFT_STORAGE_STATES) {
      const sentence = describeDraftStorage(state).toLowerCase();
      expect(sentence.length).toBeGreaterThan(0);
      for (const forbidden of ['saved to age', 'synced', 'uploaded', 'shared']) {
        expect(sentence).not.toContain(forbidden);
      }
    }
  });

  /**
   * 🚫 "Not stored" must never be printed for a write that happened — the whole
   * point of the second arm.
   */
  it('🚫 the workspace-file sentence never says nothing was written', () => {
    const sentence = describeDraftStorage('workspace-file');
    expect(sentence).toContain('discovery workspace');
    expect(sentence).toContain('answer file is unchanged');
    expect(sentence.toLowerCase()).not.toContain('nothing was written');
    expect(sentence.toLowerCase()).not.toContain('not be there when');
  });

  it('does not mutate the draft it was given', () => {
    const before = emptyIntakeDraft();
    recordPassageInDraft({
      draft: before,
      question: QUESTION,
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });

    expect(before.answers).toHaveLength(0);
  });

  /**
   * 🚫 REFUSED, never downgraded to `stated` (ADR-0066 §0.4c). A blank label
   * still composes a non-empty locator — `" (line 3)"` — so this is exactly the
   * case a schema check alone would pass.
   */
  it('🚫 refuses an incomplete provenance rather than downgrading it', () => {
    const outcome = recordPassageInDraft({
      draft: emptyIntakeDraft(),
      question: QUESTION,
      passage: PASSAGE,
      source: { ...SOURCE, label: '   ' },
      confirmedBy: CONFIRMED_BY,
    });

    expect(outcome.kind).toBe('refused');
    if (outcome.kind !== 'refused') return;
    expect(outcome.questionId).toBe('bi-model');
    expect(outcome.reason).toContain('the source label');
    // 🚫 The refusal must not carry the document's words into a log.
    expect(outcome.reason).not.toContain(PASSAGE.text);
  });

  it('🚫 refuses a choice question rather than picking the nearest choice', () => {
    const outcome = recordPassageInDraft({
      draft: emptyIntakeDraft(),
      question: CHOICE_QUESTION,
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });

    expect(outcome.kind).toBe('refused');
    if (outcome.kind !== 'refused') return;
    expect(outcome.questionId).toBe('bi-stage');
  });

  it('🚫 refuses an acceptance with no accepting person', () => {
    const outcome = recordPassageInDraft({
      draft: emptyIntakeDraft(),
      question: QUESTION,
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: '  ',
    });

    expect(outcome.kind).toBe('refused');
  });

  /**
   * 🚫 An overwrite destroys a recorded origin — which source, which sentence,
   * which human. The second acceptance is refused and the FIRST answer stands.
   */
  it('🚫 refuses a duplicate answer rather than overwriting the first', () => {
    const first = recordPassageInDraft({
      draft: emptyIntakeDraft(),
      question: QUESTION,
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });
    expect(first.kind).toBe('recorded');
    if (first.kind !== 'recorded') return;

    const second = recordPassageInDraft({
      draft: first.draft,
      question: QUESTION,
      passage: { ...PASSAGE, passageId: 'src-fictional-brief#2', text: 'Something else entirely.' },
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });

    expect(second.kind).toBe('refused');
    expect(first.draft.answers[0]?.value).toBe(PASSAGE.text);
  });
});

describe('recordPassageForQuestion', () => {
  const FIRST_QUESTION = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.flatMap(
    (section) => section.questions,
  )[0];
  if (FIRST_QUESTION === undefined) {
    throw new Error('The default questionnaire has no questions.');
  }

  it('finds the question inside its section and records against it', () => {
    const outcome = recordPassageForQuestion({
      draft: emptyIntakeDraft(),
      questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
      questionId: FIRST_QUESTION.id,
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });

    expect(outcome.kind).toBe('recorded');
    if (outcome.kind !== 'recorded') return;
    expect(outcome.answer.questionId).toBe(FIRST_QUESTION.id);
    expect(outcome.storage).toBe('not-stored');
  });

  it('REFUSES an unknown question and never matches the nearest one', () => {
    // 🚫 An acceptance recorded against a question AGE chose would point a real
    // human's confirmation at something they never confirmed.
    const outcome = recordPassageForQuestion({
      draft: emptyIntakeDraft(),
      questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
      questionId: 'no-such-question',
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });

    expect(outcome.kind).toBe('refused');
    if (outcome.kind !== 'refused') return;
    expect(outcome.questionId).toBe('no-such-question');
    expect(outcome.reason).toContain('not part of the discovery questionnaire');
    // 🚫 The refusal names a position, never the passage's words.
    expect(outcome.reason).not.toContain(PASSAGE.text);
  });

  it('carries a refusal from the acceptance path through unchanged', () => {
    const outcome = recordPassageForQuestion({
      draft: emptyIntakeDraft(),
      questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
      questionId: FIRST_QUESTION.id,
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: '   ',
    });

    expect(outcome.kind).toBe('refused');
  });

  /**
   * 🛑 **THE DEFECT ADR-0073 EXISTS TO FIX.** This function recorded into
   * `emptyIntakeDraft()` until ADR-0073, so a second confirmation on the same
   * document had never heard of the first. ⚠️ The caller now supplies the draft,
   * and there is 🚫 NO DEFAULT — a caller that forgets to load what is already
   * confirmed cannot silently start over.
   */
  it('records the second confirmation BESIDE the first, not instead of it', () => {
    const SECOND_QUESTION = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections
      .flatMap((section) => section.questions)
      .find((question) => question.id !== FIRST_QUESTION.id && question.kind === 'text');
    if (SECOND_QUESTION === undefined) {
      throw new Error('The default questionnaire has fewer than two text questions.');
    }

    const first = recordPassageForQuestion({
      draft: emptyIntakeDraft(),
      questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
      questionId: FIRST_QUESTION.id,
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });
    expect(first.kind).toBe('recorded');
    if (first.kind !== 'recorded') return;

    const second = recordPassageForQuestion({
      draft: first.draft,
      questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
      questionId: SECOND_QUESTION.id,
      passage: { ...PASSAGE, passageId: 'src-fictional-brief#2', text: 'A second sentence.' },
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });

    expect(second.kind).toBe('recorded');
    if (second.kind !== 'recorded') return;
    expect(second.draft.answers).toHaveLength(2);
    expect(second.draft.answers.map((answer) => answer.questionId)).toContain(FIRST_QUESTION.id);
    // ⚠️ And the first draft is untouched — a new draft was returned.
    expect(first.draft.answers).toHaveLength(1);
  });
});
