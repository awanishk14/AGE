import { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from '@age/business-discovery-contracts';
import type { DiscoveryAnswer } from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import {
  parseSourceConfirmedAnswers,
  renderSourceConfirmedAnswers,
  SourceConfirmedAnswersError,
} from './source-confirmed-answers';

/**
 * ADR-0073 D2 — the file that accepts a confirmation and 🚫 nothing else.
 *
 * ⚠️ Fixtures are OBVIOUSLY FICTIONAL, deliberately (ADR-0053 D3, ADR-0065 D1).
 * 🚫 Do not "make these more realistic".
 */
const QUESTIONNAIRE = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE;

const TEXT_QUESTION = QUESTIONNAIRE.sections
  .flatMap((section) => section.questions)
  .find((question) => question.kind === 'text');
if (TEXT_QUESTION === undefined) {
  throw new Error('The default questionnaire has no text question.');
}

const LIST_QUESTION = QUESTIONNAIRE.sections
  .flatMap((section) => section.questions)
  .find((question) => question.kind === 'list');
if (LIST_QUESTION === undefined) {
  throw new Error('The default questionnaire has no list question.');
}

const CONFIRMED: DiscoveryAnswer = {
  questionId: TEXT_QUESTION.id,
  value: 'The imaginary widget cooperative rents shelving to other imaginary co-ops.',
  provenance: {
    kind: 'confirmed-from-source',
    sourceId: 'src-fictional-brief',
    locator: 'Fictional Brief (line 3)',
    confirmedBy: 'operator@example.invalid',
  },
};

function fileWith(answers: readonly DiscoveryAnswer[], overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    questionnaireId: QUESTIONNAIRE.id,
    questionnaireVersion: QUESTIONNAIRE.version,
    answers,
    ...overrides,
  });
}

describe('renderSourceConfirmedAnswers', () => {
  it('round-trips through the parser', () => {
    const rendered = renderSourceConfirmedAnswers([CONFIRMED], QUESTIONNAIRE);
    expect(rendered.endsWith('\n')).toBe(true);
    expect(parseSourceConfirmedAnswers(rendered, QUESTIONNAIRE)).toEqual([CONFIRMED]);
  });

  /**
   * ⚠️ Re-writing an unchanged list produces byte-identical output — so a save
   * that changed nothing cannot look like a change on disk.
   */
  it('is deterministic and carries no clock or author line', () => {
    const once = renderSourceConfirmedAnswers([CONFIRMED], QUESTIONNAIRE);
    expect(renderSourceConfirmedAnswers([CONFIRMED], QUESTIONNAIRE)).toBe(once);
    expect(once).not.toContain('savedAt');
    expect(once).not.toContain('writtenBy');
  });
});

describe('parseSourceConfirmedAnswers', () => {
  it('reads back what the acceptance path produced', () => {
    expect(parseSourceConfirmedAnswers(fileWith([CONFIRMED]), QUESTIONNAIRE)).toEqual([CONFIRMED]);
  });

  it('reads an empty list as no confirmations, not as a failure', () => {
    expect(parseSourceConfirmedAnswers(fileWith([]), QUESTIONNAIRE)).toEqual([]);
  });

  /**
   * 🛑 **THE ONE RULE THIS FILE EXISTS TO KEEP** (ADR-0073 D2). A typed claim
   * must not be laundered into a confirmation, and 🚫 dropping it silently would
   * make the file look shorter than the operator left it.
   */
  it('🚫 REFUSES a `stated` entry rather than relabelling or dropping it', () => {
    const stated: DiscoveryAnswer = {
      questionId: TEXT_QUESTION.id,
      value: 'Typed by hand.',
      provenance: { kind: 'stated' },
    };

    expect(() => parseSourceConfirmedAnswers(fileWith([stated]), QUESTIONNAIRE)).toThrow(
      SourceConfirmedAnswersError,
    );
    try {
      parseSourceConfirmedAnswers(fileWith([stated]), QUESTIONNAIRE);
    } catch (error) {
      // 🚫 The refusal names a POSITION, never the answer's words.
      expect((error as Error).message).toContain(TEXT_QUESTION.id);
      expect((error as Error).message).not.toContain('Typed by hand');
    }
  });

  it('🚫 REFUSES two answers for one question rather than choosing one', () => {
    const twice = fileWith([CONFIRMED, { ...CONFIRMED, value: 'Something else entirely.' }]);
    expect(() => parseSourceConfirmedAnswers(twice, QUESTIONNAIRE)).toThrow(
      /two answers|discard a recorded confirmation/i,
    );
  });

  it('🚫 REFUSES a questionnaire version it was not written against', () => {
    const stale = fileWith([CONFIRMED], { questionnaireVersion: 'v0-imaginary' });
    expect(() => parseSourceConfirmedAnswers(stale, QUESTIONNAIRE)).toThrow(
      /questionnaire version/i,
    );
  });

  it('🚫 REFUSES a different questionnaire rather than reinterpreting it', () => {
    const other = fileWith([CONFIRMED], { questionnaireId: 'some-other-questionnaire' });
    expect(() => parseSourceConfirmedAnswers(other, QUESTIONNAIRE)).toThrow(
      SourceConfirmedAnswersError,
    );
  });

  it('🚫 REFUSES an answer to a question this questionnaire does not ask', () => {
    const unknown = fileWith([{ ...CONFIRMED, questionId: 'no-such-question' }]);
    expect(() => parseSourceConfirmedAnswers(unknown, QUESTIONNAIRE)).toThrow(/no-such-question/);
  });

  /**
   * ⚠️ The kind is declared on the QUESTION and 🚫 never inferred from the value
   * (ADR-0051).
   */
  it('🚫 REFUSES a value whose shape does not match the question', () => {
    const wrongShape = fileWith([{ ...CONFIRMED, value: ['a', 'list', 'for', 'a', 'text'] }]);
    expect(() => parseSourceConfirmedAnswers(wrongShape, QUESTIONNAIRE)).toThrow(
      /shape does not match/i,
    );

    const listAnswer: DiscoveryAnswer = {
      ...CONFIRMED,
      questionId: LIST_QUESTION.id,
      value: ['One imaginary offering'],
    };
    expect(parseSourceConfirmedAnswers(fileWith([listAnswer]), QUESTIONNAIRE)).toEqual([
      listAnswer,
    ]);
  });

  it('🚫 REFUSES malformed JSON without echoing the document', () => {
    expect(() => parseSourceConfirmedAnswers('{ not json', QUESTIONNAIRE)).toThrow(
      /not valid JSON/,
    );
    expect(() => parseSourceConfirmedAnswers('[]', QUESTIONNAIRE)).toThrow(/not a JSON object/);
    expect(() =>
      parseSourceConfirmedAnswers(
        JSON.stringify({
          questionnaireId: QUESTIONNAIRE.id,
          questionnaireVersion: QUESTIONNAIRE.version,
        }),
        QUESTIONNAIRE,
      ),
    ).toThrow(/no "answers" list/);
  });
});
