import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  PROFILE_SIGNALS,
  PROFILE_SIGNAL_TARGETS,
  TRANSCRIBED_PROFILE_SIGNALS,
  buildProfileFromAnswers,
  businessDiscoveryProfileSchema,
  validateProfileAgainstQuestionnaire,
  type DiscoveryAnswer,
} from '../index';

const OPTIONS = { id: 'profile-1', capturedAt: '2026-01-01T00:00:00.000Z' } as const;

/** Every question in the default questionnaire that declares a `satisfiedBy` signal. */
const SIGNAL_QUESTIONS = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.flatMap((section) =>
  section.questions.filter((question) => question.satisfiedBy !== undefined),
);

/** The question id that carries a given signal in the default questionnaire. */
function questionIdFor(signal: string): string {
  const question = SIGNAL_QUESTIONS.find((candidate) => candidate.satisfiedBy === signal);
  // ⚠️ Fail loudly rather than silently building an answer set for a question
  // that does not exist — that would test nothing and report success.
  expect(question, `default questionnaire must carry a question for ${signal}`).toBeDefined();
  return question!.id;
}

function answer(signal: string, value: string | readonly string[]): DiscoveryAnswer {
  return { questionId: questionIdFor(signal), value };
}

const NAME_ANSWER = answer('businessName', 'Northwind Trading');

describe('buildProfileFromAnswers (ADR-0050)', () => {
  describe('D3 — satisfiedBy is the only routing table', () => {
    it('routes every signal in the closed PROFILE_SIGNALS set, and no others', () => {
      // The producing direction is the declared inverse of the checking
      // direction. If either side gains or loses a signal, this fails.
      expect(Object.keys(PROFILE_SIGNAL_TARGETS).sort()).toEqual([...PROFILE_SIGNALS].sort());
      expect(PROFILE_SIGNALS).toHaveLength(13);
    });

    it('names exactly the two signals it refuses to transcribe, and says why', () => {
      const refused = PROFILE_SIGNALS.filter(
        (signal) => PROFILE_SIGNAL_TARGETS[signal].kind === 'untranscribable',
      );
      // ⚠️ Both targets have a REQUIRED enum field no answer supplies. Adding a
      // default for either is the inference ADR-0050 D2 prohibits.
      expect(refused).toEqual(['offerings', 'evidenceSources']);
      expect(TRANSCRIBED_PROFILE_SIGNALS).toHaveLength(11);

      for (const signal of refused) {
        const target = PROFILE_SIGNAL_TARGETS[signal];
        expect(target.kind === 'untranscribable' && target.because.length > 0).toBe(true);
      }
    });

    it('populates no structured field for a question with no satisfiedBy', () => {
      const noSignal = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections
        .flatMap((section) => section.questions)
        .find((question) => question.satisfiedBy === undefined);
      expect(noSignal).toBeDefined();

      const profile = buildProfileFromAnswers(
        [NAME_ANSWER, { questionId: noSignal!.id, value: 'Some free text' }],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );

      // Recorded as an answer (D6), but it moved no structured collection.
      expect(profile.segments).toEqual([]);
      expect(profile.competitors).toEqual([]);
      expect(profile.goals).toEqual([]);
      expect(profile.constraints).toEqual([]);
      const recorded = profile.sections.flatMap((s) => s.answers.map((a) => a.questionId));
      expect(recorded).toContain(noSignal!.id);
    });
  });

  describe('D2 — it transcribes and never infers', () => {
    it('copies scalar answers verbatim', () => {
      const profile = buildProfileFromAnswers(
        [
          NAME_ANSWER,
          answer('industry', 'Specialty coffee wholesale'),
          answer('businessModel', 'We sell roasted beans to independent cafes on subscription.'),
        ],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );

      expect(profile.businessName).toBe('Northwind Trading');
      expect(profile.industry).toBe('Specialty coffee wholesale');
      // ⚠️ NOT summarized, NOT truncated, NOT split into offerings.
      expect(profile.businessModel).toBe(
        'We sell roasted beans to independent cafes on subscription.',
      );
    });

    it('omits every optional scalar it has no answer for, rather than placeholder-filling', () => {
      const profile = buildProfileFromAnswers(
        [NAME_ANSWER],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );

      // Absent KEYS, not empty strings, not 'N/A', not null.
      expect('industry' in profile).toBe(false);
      expect('businessModel' in profile).toBe(false);
      expect('brandPositioning' in profile).toBe(false);
      expect('fieldEvidence' in profile).toBe(false);
    });

    it('makes one entry per list value with the text verbatim, and no invented fields', () => {
      const profile = buildProfileFromAnswers(
        [
          NAME_ANSWER,
          answer('segments', ['Independent cafes', 'Hotel groups']),
          answer('competitors', ['Blue Bottle']),
          answer('goals', ['Double wholesale revenue', 'Enter the Nordics']),
        ],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );

      expect(profile.segments.map((s) => s.name)).toEqual(['Independent cafes', 'Hotel groups']);
      expect(profile.competitors.map((c) => c.name)).toEqual(['Blue Bottle']);
      expect(profile.goals.map((g) => g.statement)).toEqual([
        'Double wholesale revenue',
        'Enter the Nordics',
      ]);

      // ⚠️ THE POINT OF D2. Only the identifier and the verbatim label exist.
      // `description`, `industry`, `companySize`, `geography`, `note` and
      // `horizon` are ABSENT — not undefined-valued, absent.
      expect(Object.keys(profile.segments[0] ?? {}).sort()).toEqual(['id', 'name']);
      expect(Object.keys(profile.competitors[0] ?? {}).sort()).toEqual(['id', 'name']);
      expect(Object.keys(profile.goals[0] ?? {}).sort()).toEqual(['id', 'statement']);

      // ⚠️ 'Enter the Nordics' plainly suggests a horizon and a geography. It
      // derives neither.
      expect(profile.goals[1]).toBeDefined();
      expect(profile.goals[1]).not.toHaveProperty('horizon');
      expect(profile.geographies).toEqual([]);
    });

    it('never splits one prose answer into several entries', () => {
      const profile = buildProfileFromAnswers(
        [NAME_ANSWER, answer('competitors', 'Blue Bottle, Stumptown and Counter Culture')],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );

      // A comma-separated string is ONE answer value, so it is ONE entry with
      // the text intact. Splitting on commas is inference about where the
      // operator meant one name to end and the next to begin.
      expect(profile.competitors).toHaveLength(1);
      expect(profile.competitors[0]?.name).toBe('Blue Bottle, Stumptown and Counter Culture');
    });

    it('leaves offerings and evidenceSources empty even when those questions are answered', () => {
      const profile = buildProfileFromAnswers(
        [
          NAME_ANSWER,
          answer('offerings', ['Wholesale beans', 'Barista training']),
          answer('evidenceSources', ['Founder interview']),
        ],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );

      // ⚠️ A refusal, not a gap in coverage. `Offering.type` and
      // `EvidenceSourceRef.kind` are required enums no answer supplies.
      expect(profile.offerings).toEqual([]);
      expect(profile.evidenceSources).toEqual([]);

      // ⚠️ …but the operator's words are NOT lost — D6 still recorded them.
      const values = profile.sections.flatMap((s) => s.answers.flatMap((a) => a.value));
      expect(values).toContain('Wholesale beans');
      expect(values).toContain('Founder interview');
    });

    it('derives no assumptions and no gaps', () => {
      const profile = buildProfileFromAnswers(
        [NAME_ANSWER],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      expect(profile.assumptions).toEqual([]);
      // Gaps are validateProfileAgainstQuestionnaire's output. Writing them here
      // would let the two disagree.
      expect(profile.gaps).toEqual([]);
    });
  });

  describe('D4 — a sparse answer set is valid input, not an error', () => {
    it('builds a schema-valid profile from a single answer', () => {
      const profile = buildProfileFromAnswers(
        [NAME_ANSWER],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      expect(businessDiscoveryProfileSchema.safeParse(profile).success).toBe(true);
    });

    it('builds a schema-valid profile from a full answer set', () => {
      const answers = SIGNAL_QUESTIONS.map((question) => ({
        questionId: question.id,
        value: question.kind === 'list' ? [`${question.id} value`] : `${question.id} value`,
      }));
      const profile = buildProfileFromAnswers(
        answers,
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      expect(businessDiscoveryProfileSchema.safeParse(profile).success).toBe(true);
    });

    it('ignores an answer to a question the questionnaire does not define', () => {
      const profile = buildProfileFromAnswers(
        [NAME_ANSWER, { questionId: 'not-a-question', value: 'orphan' }],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      // Not an error, and it lands nowhere — there is no section to hold it.
      const recorded = profile.sections.flatMap((s) => s.answers.map((a) => a.questionId));
      expect(recorded).not.toContain('not-a-question');
      expect(businessDiscoveryProfileSchema.safeParse(profile).success).toBe(true);
    });

    it('treats a blank or whitespace-only answer as unanswered', () => {
      const profile = buildProfileFromAnswers(
        [NAME_ANSWER, answer('industry', '   '), answer('goals', ['', '  '])],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      // A blank string would fail the schema's .min(1); omitting is correct.
      expect('industry' in profile).toBe(false);
      expect(profile.goals).toEqual([]);
      expect(businessDiscoveryProfileSchema.safeParse(profile).success).toBe(true);
    });

    it('throws only when no answer supplies a business name', () => {
      expect(() =>
        buildProfileFromAnswers(
          [answer('industry', 'Coffee')],
          DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
          OPTIONS,
        ),
      ).toThrow(/businessName/);

      // ⚠️ This is NOT "an unanswered question is an error". It is the one field
      // the profile schema itself makes required and non-empty, so the only
      // alternative would be to invent a business name.
      expect(() =>
        buildProfileFromAnswers([], DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, OPTIONS),
      ).toThrow();
    });
  });

  describe('D5 — id and capturedAt are required caller-supplied options', () => {
    it('uses the caller-supplied values verbatim', () => {
      const profile = buildProfileFromAnswers(
        [NAME_ANSWER],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      expect(profile.id).toBe('profile-1');
      expect(profile.capturedAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('throws rather than defaulting either one', () => {
      const cases = [
        { id: '', capturedAt: OPTIONS.capturedAt },
        { id: OPTIONS.id, capturedAt: '' },
        { id: OPTIONS.id },
        { capturedAt: OPTIONS.capturedAt },
        undefined,
      ];
      for (const options of cases) {
        expect(() =>
          buildProfileFromAnswers(
            [NAME_ANSWER],
            DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
            options as never,
          ),
        ).toThrow();
      }
    });

    it('reads no clock, no randomness and no environment', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(join(here, '..', 'build-profile-from-answers.ts'), 'utf8');
      // ⚠️ Strip comments first, or the module's own explanation of the rule
      // matches the banned token (the vitest-worker-cap.spec.ts lesson).
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code.length).toBeGreaterThan(0);

      for (const banned of [
        'new Date(',
        'Date.now(',
        'Math.random(',
        'performance.now(',
        'process.env',
        'fetch(',
        'node:fs',
        'crypto',
      ]) {
        expect(code.includes(banned), `must not use ${banned}`).toBe(false);
      }
    });

    it('is deterministic and independent of answer order', () => {
      const given = [
        answer('goals', ['Grow', 'Expand']),
        NAME_ANSWER,
        answer('industry', 'Coffee'),
      ];
      const first = buildProfileFromAnswers(
        given,
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      const second = buildProfileFromAnswers(
        [...given].reverse(),
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      // Output order follows the QUESTIONNAIRE, not the caller's submission.
      expect(second).toEqual(first);
    });

    it('does not mutate the answers it is given', () => {
      const answers = [NAME_ANSWER, answer('goals', ['Grow'])];
      const before = JSON.stringify(answers);
      buildProfileFromAnswers(answers, DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, OPTIONS);
      expect(JSON.stringify(answers)).toBe(before);
    });
  });

  describe('D6 — every answer is recorded in sections[].answers[]', () => {
    it('records answers that feed a signal and answers that do not', () => {
      const answers = SIGNAL_QUESTIONS.map((question) => ({
        questionId: question.id,
        value: question.kind === 'list' ? [`${question.id} value`] : `${question.id} value`,
      }));
      const profile = buildProfileFromAnswers(
        answers,
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );

      const recorded = profile.sections.flatMap((s) => s.answers.map((a) => a.questionId));
      expect(recorded.sort()).toEqual(answers.map((a) => a.questionId).sort());
    });

    it('carries the questionnaire question definitions onto each populated section', () => {
      const profile = buildProfileFromAnswers(
        [NAME_ANSWER],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      const section = profile.sections[0];
      expect(section).toBeDefined();
      expect(section?.questions.length).toBeGreaterThan(0);
      // The profile's DiscoveryQuestion shape does not declare these.
      for (const question of section?.questions ?? []) {
        expect('critical' in question).toBe(false);
        expect('satisfiedBy' in question).toBe(false);
      }
    });

    it('omits sections with no answers rather than emitting empty ones', () => {
      const profile = buildProfileFromAnswers(
        [NAME_ANSWER],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      expect(profile.sections).toHaveLength(1);
      expect(profile.sections.length).toBeLessThan(
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.length,
      );
      for (const section of profile.sections) {
        expect(section.answers.length).toBeGreaterThan(0);
      }
    });
  });

  describe('D8 — the round trip is the proof', () => {
    it('reports every answered question as answered when validated back', () => {
      const answers = SIGNAL_QUESTIONS.map((question) => ({
        questionId: question.id,
        value: question.kind === 'list' ? [`${question.id} value`] : `${question.id} value`,
      }));
      const profile = buildProfileFromAnswers(
        answers,
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      const result = validateProfileAgainstQuestionnaire(
        profile,
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
      );

      // ⚠️ THE POINT OF D8. A mapper that silently dropped answers would be
      // indistinguishable from a correct one without this.
      for (const question of SIGNAL_QUESTIONS.filter((q) => q.required)) {
        expect(
          result.answeredRequiredQuestionIds,
          `${question.id} was answered but validation did not see it`,
        ).toContain(question.id);
        expect(result.missingRequiredQuestionIds).not.toContain(question.id);
      }
    });

    it('reports unanswered required questions as missing, not as satisfied', () => {
      const profile = buildProfileFromAnswers(
        [NAME_ANSWER],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      const result = validateProfileAgainstQuestionnaire(
        profile,
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
      );

      // A sparse profile validates as incomplete — reported, never converted
      // into a pass and never treated as negative evidence.
      expect(result.valid).toBe(false);
      expect(result.missingRequiredQuestionIds.length).toBeGreaterThan(0);
      expect(result.criticalGaps.length).toBeGreaterThan(0);
    });

    it('satisfies a signal question through the structured field it populated', () => {
      // The structured half of the round trip: `segments` is satisfied by the
      // PROFILE_SIGNAL_PREDICATES reading profile.segments, not by the answer.
      const profile = buildProfileFromAnswers(
        [NAME_ANSWER, answer('segments', ['Independent cafes'])],
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        OPTIONS,
      );
      expect(profile.segments).toHaveLength(1);

      const stripped = { ...profile, sections: [] };
      const result = validateProfileAgainstQuestionnaire(
        stripped,
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
      );
      // With every recorded answer removed, the segments question is STILL
      // satisfied — proving the structured field was genuinely populated.
      expect(result.answeredRequiredQuestionIds).toContain(questionIdFor('segments'));
    });
  });
});
