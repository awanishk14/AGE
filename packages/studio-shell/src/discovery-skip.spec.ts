import { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import {
  applyDraftAnswer,
  applyDraftSkip,
  canSubmit,
  draftFromFormEntries,
  emptyDraft,
  parseDiscoveryDraft,
  renderAnswerFile,
  renderDiscoveryDraft,
  skipReasonOf,
  summarizeDiscoveryProgress,
  summarizeDiscoverySections,
  DISCOVERY_SKIP_FIELD_PREFIX,
} from './discovery-draft';

const questionnaire = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE;
const questions = questionnaire.sections.flatMap((section) => section.questions);
const optional = questions.find((question) => !question.required);
const required = questions.find((question) => question.required);

if (optional === undefined || required === undefined) {
  throw new Error('the shipped questionnaire must have both a required and an optional question');
}

describe('a deliberate skip is a third state, not a blank', () => {
  it('is not counted as answered', () => {
    const draft = applyDraftSkip(emptyDraft(questionnaire), optional.id, 'not-applicable');
    const progress = summarizeDiscoveryProgress(draft, questionnaire);

    // 🚫 The failure this prevents: an operator reaching "17 of 17" having
    // stated nothing at all, because skipping counted as progress.
    expect(progress.answered).toBe(0);
    expect(progress.skipped).toBe(1);
    expect(progress.open).toBe(questions.length - 1);
  });

  it('never satisfies a required question, and never unlocks submission', () => {
    const draft = questions.reduce(
      (acc, question) => applyDraftSkip(acc, question.id, 'not-applicable'),
      emptyDraft(questionnaire),
    );

    expect(summarizeDiscoveryProgress(draft, questionnaire).missingRequired.length).toBeGreaterThan(
      0,
    );
    expect(canSubmit(draft, questionnaire)).toBe(false);
  });

  it('is mutually exclusive with an answer, in both directions', () => {
    const skippedThenAnswered = applyDraftAnswer(
      applyDraftSkip(emptyDraft(questionnaire), optional.id, 'unknown'),
      optional.id,
      'the operator changed their mind',
    );
    expect(skipReasonOf(skippedThenAnswered, optional.id)).toBeUndefined();
    expect(skippedThenAnswered.answers[optional.id]).toBe('the operator changed their mind');

    const answeredThenSkipped = applyDraftSkip(
      applyDraftAnswer(emptyDraft(questionnaire), optional.id, 'a value'),
      optional.id,
      'not-applicable',
    );
    // 🚫 An answer left behind under "does not apply" would still be
    // transcribed into the profile.
    expect(answeredThenSkipped.answers[optional.id]).toBeUndefined();
    expect(skipReasonOf(answeredThenSkipped, optional.id)).toBe('not-applicable');
  });

  it('clearing a skip returns the question to not-yet-reached, not to answered', () => {
    const cleared = applyDraftSkip(
      applyDraftSkip(emptyDraft(questionnaire), optional.id, 'unknown'),
      optional.id,
      undefined,
    );

    expect(skipReasonOf(cleared, optional.id)).toBeUndefined();
    expect(summarizeDiscoveryProgress(cleared, questionnaire).open).toBe(questions.length);
  });
});

describe('the Answer File is unchanged by skips (ADR-0059 D8)', () => {
  it('writes no skip, and is byte-identical to the same answers with none', () => {
    const answered = applyDraftAnswer(emptyDraft(questionnaire), required.id, 'a stated value');
    const alsoSkipped = applyDraftSkip(answered, optional.id, 'not-applicable');

    expect(renderAnswerFile(alsoSkipped, questionnaire)).toBe(
      renderAnswerFile(answered, questionnaire),
    );
    expect(renderAnswerFile(alsoSkipped, questionnaire)).not.toContain('not-applicable');
    expect(renderAnswerFile(alsoSkipped, questionnaire)).not.toContain('skip');
  });
});

describe('a stored draft round-trips its skips', () => {
  it('survives render and parse', () => {
    const draft = applyDraftSkip(
      applyDraftAnswer(emptyDraft(questionnaire), required.id, 'a value'),
      optional.id,
      'unknown',
    );

    const restored = parseDiscoveryDraft(renderDiscoveryDraft(draft, questionnaire), questionnaire);
    expect(skipReasonOf(restored, optional.id)).toBe('unknown');
    expect(restored.answers[required.id]).toBe('a value');
  });

  it('reads a draft written before skips existed rather than refusing it', () => {
    // ⚠️ The operator's real saved draft has no `skips` key. Refusing it because
    // the console learned a new state would lose work they already did.
    const legacy = JSON.stringify({
      questionnaireId: questionnaire.id,
      questionnaireVersion: questionnaire.version,
      answers: { [required.id]: 'a value' },
    });

    const restored = parseDiscoveryDraft(legacy, questionnaire);
    expect(restored.skips).toEqual({});
    expect(restored.answers[required.id]).toBe('a value');
  });

  it('refuses a skip reason it does not define, rather than dropping it', () => {
    const tampered = JSON.stringify({
      questionnaireId: questionnaire.id,
      questionnaireVersion: questionnaire.version,
      answers: {},
      skips: { [optional.id]: 'because-i-said-so' },
    });

    expect(() => parseDiscoveryDraft(tampered, questionnaire)).toThrow(
      /reason this questionnaire does not define/,
    );
  });

  it('refuses a skip for a question that is not in this questionnaire', () => {
    const tampered = JSON.stringify({
      questionnaireId: questionnaire.id,
      questionnaireVersion: questionnaire.version,
      answers: {},
      skips: { 'not-a-question': 'unknown' },
    });

    expect(() => parseDiscoveryDraft(tampered, questionnaire)).toThrow(/not a question/);
  });
});

describe('the form round-trips a skip', () => {
  it('reads a skip field, and the skip wins over an empty text field', () => {
    const draft = draftFromFormEntries(
      {
        [optional.id]: '',
        [`${DISCOVERY_SKIP_FIELD_PREFIX}${optional.id}`]: 'not-applicable',
      },
      questionnaire,
    );

    expect(skipReasonOf(draft, optional.id)).toBe('not-applicable');
  });

  it('ignores a skip value it does not define rather than coercing one', () => {
    const draft = draftFromFormEntries(
      { [`${DISCOVERY_SKIP_FIELD_PREFIX}${optional.id}`]: 'nonsense' },
      questionnaire,
    );

    expect(skipReasonOf(draft, optional.id)).toBeUndefined();
  });
});

describe('per-section progress', () => {
  it('counts every section, and separates answered from skipped', () => {
    const sections = summarizeDiscoverySections(emptyDraft(questionnaire), questionnaire);
    expect(sections.length).toBe(questionnaire.sections.length);
    expect(sections.reduce((sum, section) => sum + section.total, 0)).toBe(questions.length);

    const withSkip = summarizeDiscoverySections(
      applyDraftSkip(emptyDraft(questionnaire), optional.id, 'unknown'),
      questionnaire,
    );
    const owner = withSkip.find((section) => section.sectionId === optional.sectionId);
    expect(owner?.skipped).toBe(1);
    expect(owner?.answered).toBe(0);
  });

  it('reports required questions still outstanding per section', () => {
    const sections = summarizeDiscoverySections(emptyDraft(questionnaire), questionnaire);
    expect(sections.reduce((sum, section) => sum + section.requiredOutstanding, 0)).toBe(
      questions.filter((question) => question.required).length,
    );
  });
});
