import { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from '@age/business-discovery-contracts';
import { parseDiscoveryAnswerFile } from '@age/discovery-answer-file';
import { describe, expect, it } from 'vitest';

import {
  applyDraftAnswer,
  canSubmit,
  DiscoveryDraftError,
  emptyDraft,
  isListQuestion,
  parseDiscoveryDraft,
  renderAnswerFile,
  renderDiscoveryDraft,
  summarizeDiscoveryProgress,
  validateDraft,
  type DiscoveryDraft,
} from './discovery-draft';

const questionnaire = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE;
const questions = questionnaire.sections.flatMap((section) => section.questions);

/** Every required question answered with something structurally acceptable. */
function completeDraft(): DiscoveryDraft {
  return questions
    .filter((question) => question.required)
    .reduce(
      (draft, question) =>
        applyDraftAnswer(
          draft,
          question.id,
          isListQuestion(question)
            ? ['A fictional entry']
            : (question.choices?.[0] ?? 'A fictional answer'),
        ),
      emptyDraft(questionnaire),
    );
}

describe('the questionnaire this form renders', () => {
  it('has questions to render, so nothing below can pass vacuously', () => {
    expect(questionnaire.sections.length).toBeGreaterThan(5);
    expect(questions.length).toBeGreaterThan(10);
  });
});

describe('applyDraftAnswer', () => {
  it('records an answer without mutating the draft it was given', () => {
    const before = emptyDraft(questionnaire);
    const after = applyDraftAnswer(before, 'bi-name', 'Fictional Business');

    expect(after.answers['bi-name']).toBe('Fictional Business');
    expect(before.answers['bi-name']).toBeUndefined();
  });

  it('REMOVES the answer when the operator clears the field', () => {
    // 🚫 The load-bearing case. An empty string stored as an answer would make
    // a profile that is missing data look more complete than it is.
    const draft = applyDraftAnswer(
      applyDraftAnswer(emptyDraft(questionnaire), 'bi-name', 'Fictional'),
      'bi-name',
      '   ',
    );

    expect('bi-name' in draft.answers).toBe(false);
  });

  it('drops blank list entries rather than storing them', () => {
    const listQuestion = questions.find(isListQuestion);
    expect(listQuestion).toBeDefined();

    const draft = applyDraftAnswer(emptyDraft(questionnaire), listQuestion!.id, ['a', '  ', 'b']);
    expect(draft.answers[listQuestion!.id]).toEqual(['a', 'b']);
  });

  it('removes a list whose every entry was blank', () => {
    const listQuestion = questions.find(isListQuestion)!;
    const draft = applyDraftAnswer(emptyDraft(questionnaire), listQuestion.id, ['', '   ']);
    expect(listQuestion.id in draft.answers).toBe(false);
  });
});

describe('renderAnswerFile', () => {
  it('produces a file the canonical parser accepts', () => {
    // ⚠️ The whole point of the slice: the console authors the SAME artifact
    // the CLI consumes. This asserts it with the CLI's own parser.
    const text = renderAnswerFile(completeDraft(), questionnaire);
    expect(() => parseDiscoveryAnswerFile(text, questionnaire)).not.toThrow();
  });

  it('omits unanswered questions entirely', () => {
    const text = renderAnswerFile(
      applyDraftAnswer(emptyDraft(questionnaire), 'bi-name', 'Fictional'),
      questionnaire,
    );
    const document = JSON.parse(text) as { answers: readonly { questionId: string }[] };

    expect(document.answers).toHaveLength(1);
    expect(document.answers[0]?.questionId).toBe('bi-name');
  });

  it('is deterministic — question order, never fill-in order', () => {
    const forwards = questions
      .filter((question) => question.required)
      .reduce(
        (draft, question) =>
          applyDraftAnswer(draft, question.id, isListQuestion(question) ? ['x'] : 'x'),
        emptyDraft(questionnaire),
      );

    const backwards = [...questions.filter((question) => question.required)]
      .reverse()
      .reduce(
        (draft, question) =>
          applyDraftAnswer(draft, question.id, isListQuestion(question) ? ['x'] : 'x'),
        emptyDraft(questionnaire),
      );

    expect(renderAnswerFile(forwards, questionnaire)).toBe(
      renderAnswerFile(backwards, questionnaire),
    );
  });

  it('carries no timestamp, author or generated id', () => {
    // 🚫 Two saves of the same answers must not differ. A clock here would also
    // be an effect in a module that must stay pure.
    const text = renderAnswerFile(completeDraft(), questionnaire);
    expect(text).not.toMatch(/generatedAt|savedAt|createdAt|author|"id"/);
  });
});

describe('validateDraft', () => {
  it('accepts a structurally sound draft', () => {
    expect(validateDraft(completeDraft(), questionnaire)).toEqual({ kind: 'valid' });
  });

  it('accepts an INCOMPLETE draft — being unfinished is not an error', () => {
    // ⚠️ A draft is normally incomplete. Refusing one would make autosave
    // impossible, which is the opposite of preserving the operator's typing.
    const draft = applyDraftAnswer(emptyDraft(questionnaire), 'bi-name', 'Fictional');
    expect(validateDraft(draft, questionnaire).kind).toBe('valid');
  });

  /**
   * ⚠️ These build the draft object DIRECTLY rather than through
   * `applyDraftAnswer`, because `applyDraftAnswer` cannot produce these states.
   * That is the point: the check must hold for a draft that reached the process
   * some other way — a hand-edited file on disk, or a future caller.
   */
  it('refuses a value whose shape contradicts the question, naming it', () => {
    const listQuestion = questions.find(isListQuestion)!;
    const result = validateDraft(
      { ...emptyDraft(questionnaire), answers: { [listQuestion.id]: 'not a list' } },
      questionnaire,
    );

    expect(result.kind).toBe('refused');
    expect(result.kind === 'refused' && result.questionId).toBe(listQuestion.id);
  });

  it('refuses an answer to a question that does not exist', () => {
    const result = validateDraft(
      { ...emptyDraft(questionnaire), answers: { 'no-such-question': 'x' } },
      questionnaire,
    );

    expect(result.kind).toBe('refused');
    expect(result.kind === 'refused' && result.reason).toContain('no-such-question');
  });

  it('does not echo the operator answer in the refusal', () => {
    // 🚫 A refusal must not carry a real business's words into a log.
    const listQuestion = questions.find(isListQuestion)!;
    const secret = 'a real business name that must not travel';
    const result = validateDraft(
      { ...emptyDraft(questionnaire), answers: { [listQuestion.id]: secret } },
      questionnaire,
    );

    expect(result.kind === 'refused' && result.reason).not.toContain(secret);
  });
});

describe('summarizeDiscoveryProgress', () => {
  it('counts nothing answered on an empty draft', () => {
    const progress = summarizeDiscoveryProgress(emptyDraft(questionnaire), questionnaire);

    expect(progress.answered).toBe(0);
    expect(progress.total).toBe(questions.length);
    expect(progress.requiredAnswered).toBe(0);
    expect(progress.missingRequired.length).toBe(progress.requiredTotal);
  });

  it('counts what the operator actually answered', () => {
    const progress = summarizeDiscoveryProgress(completeDraft(), questionnaire);

    expect(progress.requiredAnswered).toBe(progress.requiredTotal);
    expect(progress.missingRequired).toEqual([]);
  });

  it('reports missing required questions in questionnaire order', () => {
    const progress = summarizeDiscoveryProgress(emptyDraft(questionnaire), questionnaire);
    const expected = questions.filter((question) => question.required).map((q) => q.id);

    expect(progress.missingRequired.map((q) => q.id)).toEqual(expected);
  });
});

describe('canSubmit', () => {
  it('refuses an empty draft', () => {
    expect(canSubmit(emptyDraft(questionnaire), questionnaire)).toBe(false);
  });

  it('refuses a draft missing one required answer', () => {
    const required = questions.find((question) => question.required)!;
    const draft = { ...completeDraft() };
    const answers = { ...draft.answers };
    delete answers[required.id];

    expect(canSubmit({ ...draft, answers }, questionnaire)).toBe(false);
  });

  it('permits a complete, structurally valid draft', () => {
    expect(canSubmit(completeDraft(), questionnaire)).toBe(true);
  });
});

describe('parseDiscoveryDraft', () => {
  it('round-trips a draft', () => {
    const draft = completeDraft();
    const restored = parseDiscoveryDraft(renderDiscoveryDraft(draft, questionnaire), questionnaire);

    expect(restored.answers).toEqual(draft.answers);
  });

  it('REFUSES a draft written against another questionnaire version', () => {
    // 🚫 Never migrated. Re-pointing old answers at changed questions would
    // fabricate what the operator meant.
    const text = JSON.stringify({
      questionnaireId: questionnaire.id,
      questionnaireVersion: '1999.1',
      answers: {},
    });

    expect(() => parseDiscoveryDraft(text, questionnaire)).toThrow(DiscoveryDraftError);
    expect(() => parseDiscoveryDraft(text, questionnaire)).toThrow(/1999\.1/);
  });

  it('REFUSES an unknown question rather than dropping it', () => {
    const text = JSON.stringify({
      questionnaireId: questionnaire.id,
      questionnaireVersion: questionnaire.version,
      answers: { 'no-such-question': 'x' },
    });

    expect(() => parseDiscoveryDraft(text, questionnaire)).toThrow(/no-such-question/);
  });

  it('refuses a list value stored as text, and text stored as a list', () => {
    const listQuestion = questions.find(isListQuestion)!;
    const textQuestion = questions.find((question) => question.kind === 'text')!;

    expect(() =>
      parseDiscoveryDraft(
        JSON.stringify({
          questionnaireId: questionnaire.id,
          questionnaireVersion: questionnaire.version,
          answers: { [listQuestion.id]: 'not a list' },
        }),
        questionnaire,
      ),
    ).toThrow(/not a list of strings/);

    expect(() =>
      parseDiscoveryDraft(
        JSON.stringify({
          questionnaireId: questionnaire.id,
          questionnaireVersion: questionnaire.version,
          answers: { [textQuestion.id]: ['a'] },
        }),
        questionnaire,
      ),
    ).toThrow(/is not text/);
  });

  it('does not surface the JSON parser message, which quotes the source', () => {
    const secret = 'a real business name';
    let message = '';
    try {
      parseDiscoveryDraft(`{"x": ${secret}`, questionnaire);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe('The saved draft is not valid JSON.');
    expect(message).not.toContain(secret);
  });
});
