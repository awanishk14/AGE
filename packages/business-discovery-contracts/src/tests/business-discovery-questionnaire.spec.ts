import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  businessDiscoveryQuestionnaireSchema,
  questionnaireValidationResultSchema,
  validateProfileAgainstQuestionnaire,
  DISCOVERY_SECTION_IDS,
} from '../index';
import type { BusinessDiscoveryProfile, BusinessDiscoveryQuestionnaire } from '../index';

/** Minimal valid profile: only the required core fields populated. */
function buildProfile(overrides: Partial<BusinessDiscoveryProfile> = {}): BusinessDiscoveryProfile {
  return {
    id: 'profile-1',
    businessName: 'Acme CRM',
    geographies: [],
    marketingChannels: [],
    sections: [],
    segments: [],
    offerings: [],
    competitors: [],
    goals: [],
    constraints: [],
    assets: [],
    evidenceSources: [],
    assumptions: [],
    gaps: [],
    capturedAt: '2026-07-19T00:00:00.000Z',
    ...overrides,
  };
}

/** A profile that satisfies every required question via structured data. */
function buildCompleteProfile(): BusinessDiscoveryProfile {
  return buildProfile({
    industry: 'B2B SaaS',
    businessModel: 'subscription',
    geographies: ['US', 'EU'],
    offerings: [{ id: 'off-1', name: 'CRM Pro', type: 'service' }],
    segments: [{ id: 'seg-1', name: 'SMB sales teams' }],
    goals: [{ id: 'goal-1', statement: 'double MRR', horizon: 'medium' }],
  });
}

const questionnaire = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE;

describe('@age/business-discovery-contracts — default questionnaire definition', () => {
  it('parses the default questionnaire successfully', () => {
    expect(businessDiscoveryQuestionnaireSchema.safeParse(questionnaire).success).toBe(true);
  });

  it('covers every declared discovery section id exactly once', () => {
    const sectionIds = questionnaire.sections.map((section) => section.id);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    for (const id of DISCOVERY_SECTION_IDS) {
      expect(sectionIds).toContain(id);
    }
    expect(sectionIds).toHaveLength(DISCOVERY_SECTION_IDS.length);
  });

  it('exposes identifiable required questions', () => {
    const required = questionnaire.sections
      .flatMap((section) => section.questions)
      .filter((question) => question.required);
    expect(required.length).toBeGreaterThan(0);
    expect(required.map((question) => question.id)).toContain('bi-name');
  });

  it('marks core intake questions as critical', () => {
    const critical = questionnaire.sections
      .flatMap((section) => section.questions)
      .filter((question) => question.critical)
      .map((question) => question.id);
    expect(critical).toEqual(
      expect.arrayContaining(['bi-name', 'off-list', 'icp-segments', 'gc-goals']),
    );
  });
});

describe('@age/business-discovery-contracts — questionnaire validation', () => {
  it('passes a profile that satisfies every required question', () => {
    const result = validateProfileAgainstQuestionnaire(buildCompleteProfile(), questionnaire);
    expect(result.valid).toBe(true);
    expect(result.missingRequiredQuestionIds).toHaveLength(0);
    expect(result.missingRequiredSectionIds).toHaveLength(0);
    expect(result.criticalGaps).toHaveLength(0);
  });

  it('returns a schema-valid, structured result', () => {
    const result = validateProfileAgainstQuestionnaire(buildCompleteProfile(), questionnaire);
    expect(questionnaireValidationResultSchema.safeParse(result).success).toBe(true);
    expect(result.questionnaireId).toBe(questionnaire.id);
    expect(result.questionnaireVersion).toBe(questionnaire.version);
  });

  it('fails a profile missing required business identity data', () => {
    // Only businessName present; industry and businessModel are missing.
    const result = validateProfileAgainstQuestionnaire(buildProfile(), questionnaire);
    expect(result.valid).toBe(false);
    expect(result.missingRequiredQuestionIds).toEqual(
      expect.arrayContaining(['bi-industry', 'bi-model']),
    );
    // businessName is satisfied via the structured signal.
    expect(result.answeredRequiredQuestionIds).toContain('bi-name');
  });

  it('reports missing ICP, offerings and goals as critical gaps', () => {
    const result = validateProfileAgainstQuestionnaire(buildProfile(), questionnaire);
    const gapQuestionIds = result.criticalGaps.map((gap) => gap.missing);
    expect(result.missingRequiredQuestionIds).toEqual(
      expect.arrayContaining(['off-list', 'icp-segments', 'gc-goals']),
    );
    expect(result.criticalGaps.every((gap) => gap.severity === 'critical')).toBe(true);
    expect(gapQuestionIds.length).toBeGreaterThanOrEqual(3);
  });

  it('flags whole sections whose required questions are all unsatisfied', () => {
    const result = validateProfileAgainstQuestionnaire(buildProfile(), questionnaire);
    expect(result.missingRequiredSectionIds).toEqual(
      expect.arrayContaining(['offerings', 'customers-icp', 'goals-constraints']),
    );
  });

  it('accepts an explicit non-empty answer in place of a structured signal', () => {
    const profile = buildCompleteProfile();
    const withoutIndustry: BusinessDiscoveryProfile = { ...profile, industry: undefined };
    // Explicit answer to the industry question, captured in a section.
    const answered: BusinessDiscoveryProfile = {
      ...withoutIndustry,
      sections: [
        {
          id: 'business-identity',
          name: 'Business Identity',
          questions: [],
          answers: [{ questionId: 'bi-industry', value: 'B2B SaaS' }],
        },
      ],
    };
    const result = validateProfileAgainstQuestionnaire(answered, questionnaire);
    expect(result.answeredRequiredQuestionIds).toContain('bi-industry');
    expect(result.valid).toBe(true);
  });

  it('does not treat an empty-string answer as satisfying a required question', () => {
    const profile = buildCompleteProfile();
    const withoutIndustry: BusinessDiscoveryProfile = {
      ...profile,
      industry: undefined,
      sections: [
        {
          id: 'business-identity',
          name: 'Business Identity',
          questions: [],
          answers: [{ questionId: 'bi-industry', value: '   ' }],
        },
      ],
    };
    const result = validateProfileAgainstQuestionnaire(withoutIndustry, questionnaire);
    expect(result.missingRequiredQuestionIds).toContain('bi-industry');
  });

  it('is deterministic — identical inputs yield identical results', () => {
    const profile = buildProfile();
    const first = validateProfileAgainstQuestionnaire(profile, questionnaire);
    const second = validateProfileAgainstQuestionnaire(profile, questionnaire);
    expect(first).toEqual(second);
  });

  it('does not mutate the input profile', () => {
    const profile = buildProfile();
    const snapshot = JSON.stringify(profile);
    validateProfileAgainstQuestionnaire(profile, questionnaire);
    expect(JSON.stringify(profile)).toBe(snapshot);
  });
});

describe('@age/business-discovery-contracts — questionnaire entrypoint exports', () => {
  it('resolves the questionnaire, default definition and validator from the index', () => {
    expect(typeof validateProfileAgainstQuestionnaire).toBe('function');
    expect(typeof businessDiscoveryQuestionnaireSchema.safeParse).toBe('function');
    const definition: BusinessDiscoveryQuestionnaire = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE;
    expect(definition.sections.length).toBeGreaterThan(0);
  });
});
