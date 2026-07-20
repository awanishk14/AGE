import { describe, expect, it } from 'vitest';
import * as packageEntrypoint from '../index';
import {
  BUSINESS_DISCOVERY_SCORING_VERSION,
  DISCOVERY_SECTION_WEIGHTS,
  businessDiscoveryCompletenessScoreSchema,
  calculateBusinessDiscoveryCompleteness,
} from '../completeness-scoring';
import { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from '../default-questionnaire';
import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '../sample-profile';
import { DISCOVERY_SECTION_IDS } from '../enums';
import type { BusinessDiscoveryProfile } from '../business-discovery-profile';

/**
 * A minimal profile that still satisfies `businessDiscoveryProfileSchema`: only
 * the two required core fields carry content, every list is empty. This is the
 * "we have barely started discovery" floor case.
 */
const MINIMAL_PROFILE: BusinessDiscoveryProfile = {
  id: 'minimal-profile',
  businessName: 'Minimal Co',
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
  capturedAt: '2026-07-01T00:00:00.000Z',
};

describe('Business Discovery completeness scoring', () => {
  describe('completeness score', () => {
    it('gives the fully-populated sample profile a high score', () => {
      const result = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      expect(result.completenessScore).toBeGreaterThanOrEqual(90);
      expect(result.readinessBand).toBe('strong');
    });

    it('gives a minimal valid profile a low score', () => {
      const result = calculateBusinessDiscoveryCompleteness(MINIMAL_PROFILE);
      expect(result.completenessScore).toBeLessThan(20);
      expect(result.readinessBand).toBe('incomplete');
    });

    it('reduces the score when a critical field is removed', () => {
      const full = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      const withoutOfferings = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        offerings: [],
      });
      expect(withoutOfferings.completenessScore).toBeLessThan(full.completenessScore);
      expect(withoutOfferings.criticalGapCount).toBeGreaterThan(full.criticalGapCount);
    });

    it('reduces the score for each successive missing area (monotonic)', () => {
      const base = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      const one = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        assets: [],
      });
      const two = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        assets: [],
        constraints: [],
      });
      expect(one.completenessScore).toBeLessThan(base.completenessScore);
      expect(two.completenessScore).toBeLessThan(one.completenessScore);
    });
  });

  describe('discovery input confidence score', () => {
    it('drops when critical gaps are present', () => {
      const full = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      const gapped = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        goals: [],
      });
      expect(gapped.criticalGapCount).toBeGreaterThan(0);
      expect(gapped.discoveryConfidenceScore).toBeLessThan(full.discoveryConfidenceScore);
    });

    it('improves when evidence references are present', () => {
      const withoutEvidence = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        evidenceSources: [],
        sections: [],
      });
      const withEvidence = calculateBusinessDiscoveryCompleteness(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      );
      expect(withEvidence.discoveryConfidenceScore).toBeGreaterThan(
        withoutEvidence.discoveryConfidenceScore,
      );
      expect(withEvidence.evidenceReferenceCount).toBeGreaterThan(0);
    });

    it('counts assumptions without letting them inflate confidence materially', () => {
      const base = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        assumptions: [],
      });
      const manyAssumptions = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        assumptions: Array.from({ length: 40 }, (_, index) => ({
          id: `assumption-${index}`,
          statement: `Unverified statement ${index}`,
          confidence: 'high' as const,
        })),
      });

      expect(manyAssumptions.assumptionCount).toBe(40);
      // Assumptions are unverified content: declaring 40 of them must not buy
      // more than the small, capped transparency credit.
      const gain = manyAssumptions.discoveryConfidenceScore - base.discoveryConfidenceScore;
      expect(gain).toBeLessThanOrEqual(5);
    });

    it('penalises low-confidence assumptions rather than rewarding them', () => {
      const highConfidence = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        assumptions: [{ id: 'a1', statement: 'Stated assumption', confidence: 'high' }],
      });
      const lowConfidence = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        assumptions: [{ id: 'a1', statement: 'Stated assumption', confidence: 'low' }],
      });
      expect(lowConfidence.discoveryConfidenceScore).toBeLessThan(
        highConfidence.discoveryConfidenceScore,
      );
    });

    it('is low for a minimal profile with no evidence and critical gaps', () => {
      const result = calculateBusinessDiscoveryCompleteness(MINIMAL_PROFILE);
      expect(result.discoveryConfidenceScore).toBeLessThan(40);
    });
  });

  describe('clamping and shape', () => {
    it('always clamps both scores to 0-100', () => {
      const profiles: readonly BusinessDiscoveryProfile[] = [
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        MINIMAL_PROFILE,
        { ...SAMPLE_BUSINESS_DISCOVERY_PROFILE, offerings: [], goals: [], segments: [] },
        {
          ...MINIMAL_PROFILE,
          assumptions: Array.from({ length: 100 }, (_, i) => ({
            id: `a${i}`,
            statement: 's',
            confidence: 'low' as const,
          })),
        },
      ];
      for (const profile of profiles) {
        const result = calculateBusinessDiscoveryCompleteness(profile);
        expect(result.completenessScore).toBeGreaterThanOrEqual(0);
        expect(result.completenessScore).toBeLessThanOrEqual(100);
        expect(result.discoveryConfidenceScore).toBeGreaterThanOrEqual(0);
        expect(result.discoveryConfidenceScore).toBeLessThanOrEqual(100);
      }
    });

    it('produces a section breakdown covering every questionnaire section', () => {
      const result = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      expect(result.breakdown.sections).toHaveLength(
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.length,
      );
      expect(result.breakdown.sections.map((s) => s.sectionId)).toEqual(
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.map((s) => s.id),
      );
      for (const section of result.breakdown.sections) {
        expect(section.score).toBeGreaterThanOrEqual(0);
        expect(section.score).toBeLessThanOrEqual(100);
        expect(section.weight).toBeGreaterThan(0);
      }
    });

    it('validates against its own Zod schema', () => {
      const result = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      expect(businessDiscoveryCompletenessScoreSchema.safeParse(result).success).toBe(true);
    });

    it('reports counts, scoring version and machine-readable reasons', () => {
      const result = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      expect(result.scoringVersion).toBe(BUSINESS_DISCOVERY_SCORING_VERSION);
      expect(result.missingRequiredCount).toBe(0);
      expect(result.criticalGapCount).toBe(0);
      expect(result.evidenceReferenceCount).toBe(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE.evidenceSources.length,
      );
      expect(result.assumptionCount).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.assumptions.length);
      expect(result.reasons.length).toBeGreaterThan(0);
      for (const reason of result.reasons) {
        // kebab-case machine-readable codes, optionally `code:detail`.
        expect(reason).toMatch(/^[a-z0-9-]+(:[a-z0-9-]+)?$/);
      }
    });

    it('declares a weight for every discovery section id, summing to 100', () => {
      const total = DISCOVERY_SECTION_IDS.reduce(
        (sum, id) => sum + DISCOVERY_SECTION_WEIGHTS[id],
        0,
      );
      expect(total).toBe(100);
      for (const id of DISCOVERY_SECTION_IDS) {
        expect(DISCOVERY_SECTION_WEIGHTS[id]).toBeGreaterThan(0);
      }
    });
  });

  describe('purity and boundaries', () => {
    it('is deterministic across repeated runs', () => {
      const a = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      const b = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      expect(a).toEqual(b);
    });

    it('does not mutate the input profile', () => {
      const before = JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      expect(JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE)).toBe(before);
    });

    it('uses the default questionnaire when none is passed', () => {
      const implicit = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      const explicit = calculateBusinessDiscoveryCompleteness(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
      );
      expect(implicit).toEqual(explicit);
      expect(implicit.questionnaireId).toBe(DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.id);
      expect(implicit.questionnaireVersion).toBe(DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.version);
    });

    it('rejects an invalid profile at the schema boundary before scoring', () => {
      const invalid = { ...SAMPLE_BUSINESS_DISCOVERY_PROFILE, businessName: '' };
      expect(() =>
        calculateBusinessDiscoveryCompleteness(invalid as BusinessDiscoveryProfile),
      ).toThrow(/profile/i);
    });

    it('rejects an invalid questionnaire at the schema boundary', () => {
      const invalid = { ...DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, version: 'not-a-version' };
      expect(() =>
        calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE, invalid),
      ).toThrow(/questionnaire/i);
    });
  });

  describe('package entrypoint', () => {
    it('exports the scoring API from the package index', () => {
      expect(typeof packageEntrypoint.calculateBusinessDiscoveryCompleteness).toBe('function');
      expect(packageEntrypoint.BUSINESS_DISCOVERY_SCORING_VERSION).toBe(
        BUSINESS_DISCOVERY_SCORING_VERSION,
      );
      expect(packageEntrypoint.DISCOVERY_SECTION_WEIGHTS).toEqual(DISCOVERY_SECTION_WEIGHTS);
      expect(packageEntrypoint.businessDiscoveryCompletenessScoreSchema).toBeDefined();
      expect(packageEntrypoint.READINESS_BANDS).toBeDefined();
    });
  });
});
