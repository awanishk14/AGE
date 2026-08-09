import { describe, expect, it } from 'vitest';
import * as packageEntrypoint from '../index';
import {
  EVIDENCEABLE_FIELD_PATHS,
  PROFILE_SIGNAL_TO_FIELD_PATH,
  businessDiscoveryFieldEvidenceSchema,
  getEvidencedFieldPaths,
  validateBusinessDiscoveryFieldEvidence,
} from '../field-provenance';
import { STATED_ANSWER_PROVENANCE } from '../answer-provenance';
import { businessDiscoveryProfileSchema } from '../business-discovery-profile';
import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '../sample-profile';
import { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from '../default-questionnaire';
import type { BusinessDiscoveryProfile } from '../business-discovery-profile';

/** Minimal profile with declared sources but no citations of any kind. */
const BASE_PROFILE: BusinessDiscoveryProfile = {
  id: 'provenance-profile',
  businessName: 'Provenance Co',
  industry: 'B2B SaaS',
  geographies: ['United States'],
  marketingChannels: ['Organic search'],
  sections: [],
  segments: [],
  offerings: [],
  competitors: [],
  goals: [],
  constraints: [],
  assets: [],
  evidenceSources: [
    { id: 'ev-kickoff', label: 'Kickoff call notes', kind: 'client-statement' },
    { id: 'ev-deck', label: 'Company deck', kind: 'document' },
  ],
  assumptions: [],
  gaps: [],
  capturedAt: '2026-07-01T00:00:00.000Z',
};

describe('Business Discovery field-level provenance', () => {
  describe('backwards compatibility', () => {
    it('leaves the existing sample profile valid and unchanged', () => {
      expect(
        businessDiscoveryProfileSchema.safeParse(SAMPLE_BUSINESS_DISCOVERY_PROFILE).success,
      ).toBe(true);
      // The sample deliberately does not use field evidence — proving the field
      // is genuinely optional rather than optional-in-name.
      expect(SAMPLE_BUSINESS_DISCOVERY_PROFILE.fieldEvidence).toBeUndefined();
    });

    it('accepts a profile with no fieldEvidence at all', () => {
      expect(businessDiscoveryProfileSchema.safeParse(BASE_PROFILE).success).toBe(true);
      expect(validateBusinessDiscoveryFieldEvidence(BASE_PROFILE).valid).toBe(true);
      expect(getEvidencedFieldPaths(BASE_PROFILE)).toEqual([]);
    });
  });

  describe('attaching field evidence', () => {
    it('parses a profile carrying field-level evidence', () => {
      const profile: BusinessDiscoveryProfile = {
        ...BASE_PROFILE,
        fieldEvidence: { industry: ['ev-deck'], geographies: ['ev-kickoff', 'ev-deck'] },
      };
      expect(businessDiscoveryProfileSchema.safeParse(profile).success).toBe(true);
      expect(getEvidencedFieldPaths(profile)).toEqual(['industry', 'geographies']);
    });

    it('returns evidenced paths in declaration order, not insertion order', () => {
      const profile: BusinessDiscoveryProfile = {
        ...BASE_PROFILE,
        fieldEvidence: { geographies: ['ev-deck'], businessName: ['ev-kickoff'] },
      };
      // `businessName` precedes `geographies` in EVIDENCEABLE_FIELD_PATHS.
      expect(getEvidencedFieldPaths(profile)).toEqual(['businessName', 'geographies']);
    });

    it('rejects an unknown field path at the schema boundary', () => {
      const result = businessDiscoveryFieldEvidenceSchema.safeParse({ notAField: ['ev-deck'] });
      expect(result.success).toBe(false);
    });

    it('rejects an entry citing nothing', () => {
      expect(businessDiscoveryFieldEvidenceSchema.safeParse({ industry: [] }).success).toBe(false);
    });

    it('declares a field path for every questionnaire profile signal it can back', () => {
      // Every signal except `evidenceSources` (which would be self-referential)
      // maps to an evidenceable field.
      for (const [signal, fieldPath] of Object.entries(PROFILE_SIGNAL_TO_FIELD_PATH)) {
        expect(EVIDENCEABLE_FIELD_PATHS).toContain(fieldPath);
        expect(signal).toBeTruthy();
      }
      expect(PROFILE_SIGNAL_TO_FIELD_PATH.evidenceSources).toBeUndefined();
    });
  });

  describe('dangling and malformed references', () => {
    it('detects field evidence naming an undeclared evidence source', () => {
      const profile: BusinessDiscoveryProfile = {
        ...BASE_PROFILE,
        fieldEvidence: { industry: ['ev-does-not-exist'] },
      };
      const result = validateBusinessDiscoveryFieldEvidence(profile);
      expect(result.valid).toBe(false);
      expect(result.danglingFieldEvidence).toEqual([
        { fieldPath: 'industry', evidenceSourceId: 'ev-does-not-exist' },
      ]);
    });

    it('does not credit a dangling field reference as evidence', () => {
      const profile: BusinessDiscoveryProfile = {
        ...BASE_PROFILE,
        fieldEvidence: { industry: ['ev-does-not-exist'] },
      };
      expect(getEvidencedFieldPaths(profile)).toEqual([]);
    });

    it('treats a partially-dangling citation list as unevidenced', () => {
      const profile: BusinessDiscoveryProfile = {
        ...BASE_PROFILE,
        fieldEvidence: { industry: ['ev-deck', 'ev-missing'] },
      };
      expect(validateBusinessDiscoveryFieldEvidence(profile).valid).toBe(false);
      // All-or-nothing: one bad id disqualifies the field.
      expect(getEvidencedFieldPaths(profile)).toEqual([]);
    });

    it('detects answer-level dangling references too', () => {
      const profile: BusinessDiscoveryProfile = {
        ...BASE_PROFILE,
        sections: [
          {
            id: 'business-identity',
            name: 'Business Identity',
            questions: [
              {
                id: 'bi-name',
                sectionId: 'business-identity',
                prompt: 'What is the business name?',
                required: true,
                kind: 'text',
              },
            ],
            answers: [
              {
                questionId: 'bi-name',
                value: 'Provenance Co',
                provenance: STATED_ANSWER_PROVENANCE,
                evidenceSourceIds: ['ev-ghost'],
              },
            ],
          },
        ],
      };
      const result = validateBusinessDiscoveryFieldEvidence(profile);
      expect(result.valid).toBe(false);
      expect(result.danglingAnswerEvidence).toEqual([
        { questionId: 'bi-name', evidenceSourceId: 'ev-ghost' },
      ]);
    });

    it('reports empty citation lists defensively, for unparsed input', () => {
      // The schema rejects this shape; the validator is usable before parsing.
      const profile = {
        ...BASE_PROFILE,
        fieldEvidence: { industry: [] },
      } as unknown as BusinessDiscoveryProfile;
      const result = validateBusinessDiscoveryFieldEvidence(profile);
      expect(result.valid).toBe(false);
      expect(result.emptyFieldEvidencePaths).toEqual(['industry']);
    });

    it('passes a fully resolvable profile', () => {
      const profile: BusinessDiscoveryProfile = {
        ...BASE_PROFILE,
        fieldEvidence: { industry: ['ev-deck'], businessName: ['ev-kickoff'] },
      };
      const result = validateBusinessDiscoveryFieldEvidence(profile);
      expect(result).toEqual({
        valid: true,
        danglingFieldEvidence: [],
        danglingAnswerEvidence: [],
        emptyFieldEvidencePaths: [],
      });
    });

    it('validates the shipped sample profile as fully resolvable', () => {
      expect(validateBusinessDiscoveryFieldEvidence(SAMPLE_BUSINESS_DISCOVERY_PROFILE).valid).toBe(
        true,
      );
    });
  });

  describe('purity', () => {
    it('does not mutate the profile', () => {
      const profile: BusinessDiscoveryProfile = {
        ...BASE_PROFILE,
        fieldEvidence: { industry: ['ev-deck'] },
      };
      const before = JSON.stringify(profile);
      validateBusinessDiscoveryFieldEvidence(profile);
      getEvidencedFieldPaths(profile);
      expect(JSON.stringify(profile)).toBe(before);
    });

    it('is deterministic across repeated runs', () => {
      const profile: BusinessDiscoveryProfile = {
        ...BASE_PROFILE,
        fieldEvidence: { industry: ['ev-missing'], goals: ['ev-deck'] },
      };
      expect(validateBusinessDiscoveryFieldEvidence(profile)).toEqual(
        validateBusinessDiscoveryFieldEvidence(profile),
      );
      expect(getEvidencedFieldPaths(profile)).toEqual(getEvidencedFieldPaths(profile));
    });

    it('performs no questionnaire lookup or I/O to validate', () => {
      // Validation depends only on the profile, never on a questionnaire.
      const profile: BusinessDiscoveryProfile = {
        ...BASE_PROFILE,
        fieldEvidence: { industry: ['ev-deck'] },
      };
      expect(validateBusinessDiscoveryFieldEvidence(profile).valid).toBe(true);
      expect(DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.length).toBeGreaterThan(0);
    });
  });

  describe('package entrypoint', () => {
    it('exports the provenance API', () => {
      expect(typeof packageEntrypoint.validateBusinessDiscoveryFieldEvidence).toBe('function');
      expect(typeof packageEntrypoint.getEvidencedFieldPaths).toBe('function');
      expect(packageEntrypoint.EVIDENCEABLE_FIELD_PATHS).toEqual(EVIDENCEABLE_FIELD_PATHS);
      expect(packageEntrypoint.PROFILE_SIGNAL_TO_FIELD_PATH).toEqual(PROFILE_SIGNAL_TO_FIELD_PATH);
      expect(packageEntrypoint.businessDiscoveryFieldEvidenceSchema).toBeDefined();
      expect(packageEntrypoint.evidenceableFieldPathSchema).toBeDefined();
      expect(packageEntrypoint.businessDiscoveryFieldEvidenceValidationSchema).toBeDefined();
    });
  });
});
