import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  type BusinessDiscoveryQuestionnaire,
} from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { DiscoveryAnswerFileError, parseDiscoveryAnswerFile } from '../parse-discovery-answer-file';

/**
 * ADR-0054 D1 — answers arrive as an operator-authored JSON file, validated
 * AGAINST THE QUESTIONNAIRE, fail-closed, naming the offending question id.
 *
 * ⚠️ The critical failure mode this guards (D1, and ADR-0051's erratum): a
 * silently DROPPED answer would raise the completeness score of a profile that
 * is actually missing data. Every rejection below must therefore be a refusal,
 * never a skip.
 *
 * 🚫 The fixtures here stay obviously fictional (ADR-0053 D3). Real client
 * names and account ids never enter the repository.
 */

const Q = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE;

function file(answers: unknown, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    questionnaireId: Q.id,
    questionnaireVersion: Q.version,
    answers,
    ...overrides,
  });
}

describe('parseDiscoveryAnswerFile', () => {
  describe('accepts a well-formed file', () => {
    it('returns the answers it was given', () => {
      const answers = parseDiscoveryAnswerFile(
        file([{ questionId: 'bi-name', value: 'Example Fictional Co' }]),
        Q,
      );
      expect(answers).toEqual([{ questionId: 'bi-name', value: 'Example Fictional Co' }]);
    });

    it('accepts an empty answer set — absence is not an error', () => {
      // ADR-0026 D4: missing sections are limitations, never negative evidence.
      expect(parseDiscoveryAnswerFile(file([]), Q)).toEqual([]);
    });

    it('accepts a list-kind answer as an array of strings', () => {
      const listQuestion = Q.sections.flatMap((s) => s.questions).find((q) => q.kind === 'list');
      expect(listQuestion).toBeDefined();
      const answers = parseDiscoveryAnswerFile(
        file([{ questionId: listQuestion!.id, value: ['alpha', 'beta'] }]),
        Q,
      );
      expect(answers[0]?.value).toEqual(['alpha', 'beta']);
    });

    it('preserves optional evidenceSourceIds', () => {
      const answers = parseDiscoveryAnswerFile(
        file([{ questionId: 'bi-name', value: 'Example Fictional Co', evidenceSourceIds: ['e1'] }]),
        Q,
      );
      expect(answers[0]?.evidenceSourceIds).toEqual(['e1']);
    });

    it('does not require every question to be answered', () => {
      const answers = parseDiscoveryAnswerFile(
        file([{ questionId: 'bi-name', value: 'Example Fictional Co' }]),
        Q,
      );
      expect(answers).toHaveLength(1);
    });

    it('returns a frozen result that cannot be mutated', () => {
      const answers = parseDiscoveryAnswerFile(
        file([{ questionId: 'bi-name', value: 'Example Fictional Co' }]),
        Q,
      );
      expect(Object.isFrozen(answers)).toBe(true);
    });
  });

  describe('refuses a malformed file', () => {
    it('refuses text that is not JSON', () => {
      expect(() => parseDiscoveryAnswerFile('not json at all', Q)).toThrow(
        DiscoveryAnswerFileError,
      );
    });

    it('refuses a JSON array at the root', () => {
      expect(() => parseDiscoveryAnswerFile('[]', Q)).toThrow(DiscoveryAnswerFileError);
    });

    it('refuses a missing answers array', () => {
      expect(() => parseDiscoveryAnswerFile(JSON.stringify({ questionnaireId: Q.id }), Q)).toThrow(
        DiscoveryAnswerFileError,
      );
    });

    it('refuses an empty file', () => {
      expect(() => parseDiscoveryAnswerFile('', Q)).toThrow(DiscoveryAnswerFileError);
    });
  });

  describe('pins the questionnaire the answers were written against', () => {
    it('refuses a mismatched questionnaire id', () => {
      expect(() =>
        parseDiscoveryAnswerFile(file([], { questionnaireId: 'some-other-questionnaire' }), Q),
      ).toThrow(/questionnaire/i);
    });

    it('refuses a mismatched questionnaire version', () => {
      // A file written against an older questionnaire may answer questions that
      // have since changed meaning — refusing is the only safe reading.
      expect(() =>
        parseDiscoveryAnswerFile(file([], { questionnaireVersion: '1999.1' }), Q),
      ).toThrow(DiscoveryAnswerFileError);
    });
  });

  describe('refuses and NAMES the offending question id', () => {
    it('refuses an unknown questionId', () => {
      expect(() =>
        parseDiscoveryAnswerFile(file([{ questionId: 'no-such-question', value: 'x' }]), Q),
      ).toThrow(/no-such-question/);
    });

    it('refuses a duplicate questionId', () => {
      expect(() =>
        parseDiscoveryAnswerFile(
          file([
            { questionId: 'bi-name', value: 'First' },
            { questionId: 'bi-name', value: 'Second' },
          ]),
          Q,
        ),
      ).toThrow(/bi-name/);
    });

    it('refuses an array value for a scalar-kind question', () => {
      expect(() =>
        parseDiscoveryAnswerFile(file([{ questionId: 'bi-name', value: ['a', 'b'] }]), Q),
      ).toThrow(/bi-name/);
    });

    it('refuses a string value for a list-kind question', () => {
      const listQuestion = Q.sections.flatMap((s) => s.questions).find((q) => q.kind === 'list');
      expect(() =>
        parseDiscoveryAnswerFile(file([{ questionId: listQuestion!.id, value: 'a, b' }]), Q),
      ).toThrow(new RegExp(listQuestion!.id));
    });

    it('refuses a non-string value outright', () => {
      expect(() =>
        parseDiscoveryAnswerFile(file([{ questionId: 'bi-name', value: 42 }]), Q),
      ).toThrow(/bi-name/);
    });

    it('refuses an empty string — an unanswered question is ABSENT, never empty', () => {
      expect(() =>
        parseDiscoveryAnswerFile(file([{ questionId: 'bi-name', value: '' }]), Q),
      ).toThrow(/bi-name/);
    });

    it('refuses a whitespace-only string', () => {
      expect(() =>
        parseDiscoveryAnswerFile(file([{ questionId: 'bi-name', value: '   ' }]), Q),
      ).toThrow(/bi-name/);
    });

    it('refuses an empty array for a list question', () => {
      const listQuestion = Q.sections.flatMap((s) => s.questions).find((q) => q.kind === 'list');
      expect(() =>
        parseDiscoveryAnswerFile(file([{ questionId: listQuestion!.id, value: [] }]), Q),
      ).toThrow(new RegExp(listQuestion!.id));
    });

    it('refuses an array containing a blank entry', () => {
      const listQuestion = Q.sections.flatMap((s) => s.questions).find((q) => q.kind === 'list');
      expect(() =>
        parseDiscoveryAnswerFile(file([{ questionId: listQuestion!.id, value: ['ok', '  '] }]), Q),
      ).toThrow(new RegExp(listQuestion!.id));
    });

    it('refuses an unknown property on an answer rather than ignoring it', () => {
      // A typo'd key would otherwise be silently discarded.
      expect(() =>
        parseDiscoveryAnswerFile(
          file([{ questionId: 'bi-name', value: 'Example Fictional Co', note: 'oops' }]),
          Q,
        ),
      ).toThrow(/bi-name/);
    });

    it('refuses a missing questionId', () => {
      expect(() => parseDiscoveryAnswerFile(file([{ value: 'x' }]), Q)).toThrow(
        DiscoveryAnswerFileError,
      );
    });

    it('exposes the offending question id on the error', () => {
      try {
        parseDiscoveryAnswerFile(file([{ questionId: 'bi-name', value: '' }]), Q);
        expect.unreachable('should have refused');
      } catch (error) {
        expect(error).toBeInstanceOf(DiscoveryAnswerFileError);
        expect((error as DiscoveryAnswerFileError).questionId).toBe('bi-name');
      }
    });
  });

  describe('choice questions are checked against their declared choices', () => {
    // ⚠️ The default questionnaire currently declares no `choice` question, so
    // exercising the branch against it would silently test nothing. A local
    // fixture questionnaire covers the branch for real instead.
    const CHOICE_Q: BusinessDiscoveryQuestionnaire = {
      id: 'fixture-questionnaire',
      version: Q.version,
      name: 'Fixture questionnaire',
      sections: [
        {
          id: 'business-identity',
          name: 'Business identity',
          questions: [
            {
              id: 'fx-model',
              sectionId: 'business-identity',
              prompt: 'Which model?',
              required: true,
              critical: false,
              kind: 'choice',
              choices: ['b2b', 'b2c'],
            },
          ],
        },
      ],
    };

    function choiceFile(value: unknown): string {
      return JSON.stringify({
        questionnaireId: CHOICE_Q.id,
        questionnaireVersion: CHOICE_Q.version,
        answers: [{ questionId: 'fx-model', value }],
      });
    }

    it('the fixture declares a choice question with choices', () => {
      // Guard-test pattern: the branch under test must actually exist.
      const question = CHOICE_Q.sections[0]?.questions[0];
      expect(question?.kind).toBe('choice');
      expect(question?.choices?.length).toBeGreaterThan(0);
    });

    it('accepts a declared choice', () => {
      expect(parseDiscoveryAnswerFile(choiceFile('b2b'), CHOICE_Q)).toEqual([
        { questionId: 'fx-model', value: 'b2b' },
      ]);
    });

    it('refuses an undeclared choice, naming the question', () => {
      expect(() =>
        parseDiscoveryAnswerFile(choiceFile('definitely-not-a-choice'), CHOICE_Q),
      ).toThrow(/fx-model/);
    });
  });

  describe('the file is read-only input', () => {
    it('does not mutate the questionnaire it validates against', () => {
      const before = JSON.stringify(Q);
      parseDiscoveryAnswerFile(file([{ questionId: 'bi-name', value: 'Example Fictional Co' }]), Q);
      expect(JSON.stringify(Q)).toBe(before);
    });

    it('is deterministic — the same text yields the same result', () => {
      const text = file([{ questionId: 'bi-name', value: 'Example Fictional Co' }]);
      expect(parseDiscoveryAnswerFile(text, Q)).toEqual(parseDiscoveryAnswerFile(text, Q));
    });
  });
});
