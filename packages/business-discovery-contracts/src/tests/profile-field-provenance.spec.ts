import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  EVIDENCEABLE_FIELD_PATHS,
  PROFILE_SIGNAL_TO_FIELD_PATH,
  STATED_ANSWER_PROVENANCE,
  buildProfileAndFieldProvenanceFromAnswers,
  buildProfileFromAnswers,
  calculateBusinessDiscoveryCompleteness,
  fieldPathsWithRecordedProvenance,
  fieldProvenanceEntriesFor,
  getEvidencedFieldPaths,
  produceScoredBifContext,
  profileFieldProvenanceSchema,
  type AnswerProvenance,
  type DiscoveryAnswer,
} from '../index';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

const OPTIONS = { id: 'profile-1', capturedAt: '2026-01-01T00:00:00.000Z' } as const;

const BIF_OPTIONS = {
  organizationId: 'org-fixture',
  constructedAt: new Date('2026-01-01T00:00:00.000Z'),
  changedBy: 'operator@example.invalid',
} as const;

/**
 * A document-confirmed answer. 🚫 Deliberately fictional in every part —
 * ADR-0053 D3 and ADR-0065 D1: a real name in a fixture is client data, and
 * obvious fictionality IS the guard.
 */
const CONFIRMED: AnswerProvenance = {
  kind: 'confirmed-from-source',
  sourceId: 'source-fictional-brief',
  locator: 'page 2',
  confirmedBy: 'operator@example.invalid',
};

const SIGNAL_QUESTIONS = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.flatMap((section) =>
  section.questions.filter((question) => question.satisfiedBy !== undefined),
);

function questionIdFor(signal: string): string {
  const question = SIGNAL_QUESTIONS.find((candidate) => candidate.satisfiedBy === signal);
  // ⚠️ Fail loudly rather than build an answer set for a question that does not
  // exist — that would test nothing and report success.
  expect(question, `default questionnaire must carry a question for ${signal}`).toBeDefined();
  return question!.id;
}

function answer(
  signal: string,
  value: string | readonly string[],
  provenance: AnswerProvenance,
): DiscoveryAnswer {
  return { questionId: questionIdFor(signal), value, provenance };
}

/** The same facts, twice: every answer stated, and the same answers half confirmed. */
function answerSet(mixed: boolean): readonly DiscoveryAnswer[] {
  const other = mixed ? CONFIRMED : STATED_ANSWER_PROVENANCE;
  return [
    answer('businessName', 'Northwind Trading', other),
    answer('industry', 'Wholesale distribution', STATED_ANSWER_PROVENANCE),
    answer('businessModel', 'Business to business', other),
    answer('brandPositioning', 'Dependable regional supplier', other),
    answer('geographies', ['Northern region', 'Coastal region'], other),
    answer('marketingChannels', ['Trade shows', 'Email'], STATED_ANSWER_PROVENANCE),
    answer('segments', ['Independent retailers'], other),
    answer('competitors', ['Southgate Supply'], other),
    answer('goals', ['Open a second depot'], STATED_ANSWER_PROVENANCE),
    answer('constraints', ['One delivery van'], other),
    answer('assets', ['A twenty-year customer list'], other),
  ];
}

const STATED_RESULT = buildProfileAndFieldProvenanceFromAnswers(
  answerSet(false),
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  OPTIONS,
);
const MIXED_RESULT = buildProfileAndFieldProvenanceFromAnswers(
  answerSet(true),
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  OPTIONS,
);

describe('AGE-INV-PROV-1 — provenance alone never changes a score (ADR-0066 D2, §0.3c)', () => {
  it('examined two answer sets that really do differ in provenance', () => {
    // ⚠️ Without this, an accidental fixture collapse would make every
    // assertion below pass while comparing an answer set with itself.
    expect(JSON.stringify(answerSet(true))).not.toEqual(JSON.stringify(answerSet(false)));
    const kinds = MIXED_RESULT.fieldProvenance.entries.map((entry) => entry.provenance.kind);
    expect(kinds).toContain('confirmed-from-source');
    expect(kinds).toContain('stated');
    expect(
      STATED_RESULT.fieldProvenance.entries.every((entry) => entry.provenance.kind === 'stated'),
    ).toBe(true);
  });

  it('carries the differing provenance INSIDE the profile, and still moves no score', () => {
    // ⚠️ THE PROFILE ITSELF IS NOT BYTE-IDENTICAL, ON PURPOSE. `DiscoveryAnswer`
    // has carried a required `provenance` since #268, so a captured answer's
    // origin travels inside `sections[].answers[]`. 🚫 Do not "fix" that by
    // stripping it — the answer is the operator's own record of what was said
    // and how it arrived.
    //
    // ⚠️ AGE-INV-PROV-1 is about SCORES AND RESULTS, not about the profile
    // blob: *"identical profile facts with different provenance must produce
    // byte-identical scores/results"*. This test pins the harder version of it —
    // the difference is right there where every scorer could reach it, and the
    // three assertions below show that none of them does.
    expect(JSON.stringify(MIXED_RESULT.profile)).not.toEqual(JSON.stringify(STATED_RESULT.profile));
    expect(JSON.stringify(MIXED_RESULT.profile)).toContain('confirmed-from-source');
  });

  it('produces byte-identical FACTS — everything but the answers’ own origin', () => {
    const facts = (profile: typeof MIXED_RESULT.profile): string =>
      JSON.stringify({
        ...profile,
        sections: profile.sections.map((section) => ({
          ...section,
          answers: section.answers.map(({ provenance, ...rest }) => {
            // Named and discarded: the ONLY difference between the two inputs.
            expect(provenance.kind.length).toBeGreaterThan(0);
            return rest;
          }),
        })),
      });

    expect(facts(MIXED_RESULT.profile)).toEqual(facts(STATED_RESULT.profile));
  });

  it('produces a byte-identical intake completeness score', () => {
    expect(JSON.stringify(calculateBusinessDiscoveryCompleteness(MIXED_RESULT.profile))).toEqual(
      JSON.stringify(calculateBusinessDiscoveryCompleteness(STATED_RESULT.profile)),
    );
  });

  it('produces a byte-identical BIF context, mapping metadata and scoring metadata', () => {
    expect(JSON.stringify(produceScoredBifContext(MIXED_RESULT.profile, BIF_OPTIONS))).toEqual(
      JSON.stringify(produceScoredBifContext(STATED_RESULT.profile, BIF_OPTIONS)),
    );
  });

  it('🚫 never becomes evidence: a confirmed answer evidences nothing', () => {
    // ⚠️ THE HAZARD BY NAME. `getEvidencedFieldPaths` is what scoring reads —
    // `completeness-scoring.ts` (evidenced sections escape the uncited cap) and
    // `business-discovery-to-bif.ts` (each field's `FieldSource`). A document
    // having been read must not put a single path in here.
    expect(getEvidencedFieldPaths(MIXED_RESULT.profile)).toEqual([]);
    expect(MIXED_RESULT.profile.fieldEvidence).toBeUndefined();
  });
});

describe('the channel is separate by SHAPE, not only by discipline', () => {
  it('has no slot on the profile', () => {
    expect(Object.keys(MIXED_RESULT.profile)).not.toContain('fieldProvenance');
    expect(Object.keys(MIXED_RESULT.profile)).not.toContain('provenance');
  });

  it('hands the profile-only entry point nothing to condition on', () => {
    // Every scorer, the BIF mapper and the readiness layer call this one.
    const profile = buildProfileFromAnswers(
      answerSet(true),
      DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
      OPTIONS,
    );
    expect(JSON.stringify(profile)).toEqual(JSON.stringify(MIXED_RESULT.profile));
  });

  it('🚫 the scoring and BIF modules cannot see the channel', () => {
    const modules = [
      'completeness-scoring.ts',
      'business-discovery-to-bif.ts',
      'bif-confidence-scoring.ts',
      'scored-bif-context.ts',
    ];
    let examined = 0;

    for (const module of modules) {
      const source = readFileSync(join(SRC, module), 'utf8');
      // ⚠️ Comments legitimately explain the rule and would match the tokens
      // they forbid, so they come off before the scan.
      const executable = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(executable.length, module).toBeGreaterThan(200);
      examined += 1;

      for (const token of [
        'profile-field-provenance',
        'ProfileFieldProvenance',
        'AnswerProvenance',
        'confirmed-from-source',
        'STATED_ANSWER_PROVENANCE',
        'fieldProvenance',
      ]) {
        expect(executable, `${module} must not read ${token}`).not.toContain(token);
      }
    }

    // ⚠️ An empty module list would let the loop above report compliance.
    expect(examined).toBe(modules.length);
  });

  it('🚫 carries no number of any kind', () => {
    // ADR-0059 D3 / ADR-0066 D3 — a number here would be read as a degree of
    // belief the moment anything rendered it.
    const source = readFileSync(join(SRC, 'profile-field-provenance.ts'), 'utf8');
    const executable = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(executable.length).toBeGreaterThan(200);

    for (const token of ['score', 'confidence', 'weight', 'z.number']) {
      expect(executable.toLowerCase(), token).not.toContain(token.toLowerCase());
    }
    for (const entry of MIXED_RESULT.fieldProvenance.entries) {
      for (const value of Object.values(entry)) {
        expect(typeof value).not.toBe('number');
      }
    }
  });
});

describe('what the channel records', () => {
  it('names the question and the field for every routed signal', () => {
    const recorded = fieldPathsWithRecordedProvenance(MIXED_RESULT.fieldProvenance);
    const routed = Object.values(PROFILE_SIGNAL_TO_FIELD_PATH);

    expect(recorded.length).toBeGreaterThan(0);
    for (const fieldPath of recorded) {
      expect(EVIDENCEABLE_FIELD_PATHS).toContain(fieldPath);
      expect(routed).toContain(fieldPath);
    }
    for (const entry of MIXED_RESULT.fieldProvenance.entries) {
      expect(entry.questionId.length).toBeGreaterThan(0);
    }
  });

  it('🚫 claims no origin for a field no answer produced', () => {
    // `offerings` is unanswered in this fixture — a sparse profile is the
    // correct output of a sparse answer set (ADR-0050 D4), and an absent entry
    // is **not-recorded**, never a default `stated`.
    expect(MIXED_RESULT.profile.offerings).toEqual([]);
    expect(fieldProvenanceEntriesFor(MIXED_RESULT.fieldProvenance, 'offerings')).toEqual([]);
    expect(fieldPathsWithRecordedProvenance(MIXED_RESULT.fieldProvenance)).not.toContain(
      'offerings',
    );
  });

  it('🚫 records no origin for evidenceSources — a source citing its own origin is circular', () => {
    // ⚠️ Two independent statements. `evidenceSources` is absent from the
    // routing map, so no entry can be produced for it — and it is absent from
    // `EvidenceableFieldPath`, so no entry could even be TYPED for it. (A
    // runtime `entry.fieldPath === 'evidenceSources'` comparison is a compile
    // error here for exactly that reason, which is the stronger guarantee.)
    expect(Object.keys(PROFILE_SIGNAL_TO_FIELD_PATH)).not.toContain('evidenceSources');
    expect(EVIDENCEABLE_FIELD_PATHS as readonly string[]).not.toContain('evidenceSources');
    expect(
      (MIXED_RESULT.fieldProvenance.entries as readonly { fieldPath: string }[]).some(
        (entry) => entry.fieldPath === 'evidenceSources',
      ),
    ).toBe(false);
  });

  it('travels with the id of the profile it describes', () => {
    expect(MIXED_RESULT.fieldProvenance.profileId).toBe(OPTIONS.id);
    expect(MIXED_RESULT.fieldProvenance.profileId).toBe(MIXED_RESULT.profile.id);
  });

  it('parses as its own schema', () => {
    expect(profileFieldProvenanceSchema.safeParse(MIXED_RESULT.fieldProvenance).success).toBe(true);
  });

  it('keeps two sources for one field as two entries, never merged', () => {
    // ADR-0066 D5 — two labels, never one summarised label and never a diff.
    const twoAnswers = [
      answer('businessName', 'Northwind Trading', STATED_ANSWER_PROVENANCE),
      answer('geographies', ['Northern region'], CONFIRMED),
    ];
    const { fieldProvenance } = buildProfileAndFieldProvenanceFromAnswers(
      twoAnswers,
      DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
      OPTIONS,
    );
    expect(fieldProvenance.entries).toHaveLength(2);
    expect(fieldProvenanceEntriesFor(fieldProvenance, 'geographies')).toHaveLength(1);
    expect(fieldProvenanceEntriesFor(fieldProvenance, 'businessName')[0]?.provenance.kind).toBe(
      'stated',
    );
  });
});
