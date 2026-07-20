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
import type { BusinessDiscoveryQuestionnaire } from '../questionnaire';

/**
 * Scores are pinned to exact expected values, not ranges. Ranges pass whether or
 * not the absolute numbers mean anything; pinning forces any model change to be
 * a deliberate, reviewed edit to this file.
 */

/** Minimal schema-valid profile: only the required core fields carry content. */
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

/**
 * Fully-populated profile stripped of every evidence signal: no evidence
 * sources, no evidence-linked answers, no declared assumptions. This is the case
 * that must NOT read as confident or ready.
 */
const ZERO_EVIDENCE_COMPLETE_PROFILE: BusinessDiscoveryProfile = {
  ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  evidenceSources: [],
  sections: [],
  assumptions: [],
};

/** Sample profile with a critical area (goals) removed. */
const MISSING_CRITICAL_PROFILE: BusinessDiscoveryProfile = {
  ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  goals: [],
};

/**
 * Evidence sources are declared, but no captured answer cites any of them —
 * nominal evidence. Must not read as confident, and must not beat a profile
 * that genuinely cites fewer sources.
 */
const LISTED_BUT_UNCITED_PROFILE: BusinessDiscoveryProfile = {
  ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  sections: [],
};

/** The same, but padding the list with many more uncited sources. */
const UNCITED_MANY_SOURCES_PROFILE: BusinessDiscoveryProfile = {
  ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  sections: [],
  evidenceSources: Array.from({ length: 8 }, (_, index) => ({
    id: `padded-source-${index}`,
    label: `Padded source ${index}`,
    kind: 'document' as const,
  })),
};

/** Genuinely cites its evidence, but declares only a single source. */
const CITED_SINGLE_SOURCE_PROFILE: BusinessDiscoveryProfile = {
  ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  evidenceSources: SAMPLE_BUSINESS_DISCOVERY_PROFILE.evidenceSources.slice(0, 1),
};

describe('Business Discovery completeness scoring', () => {
  describe('pinned score examples', () => {
    it('scores the fully-populated sample profile', () => {
      const result = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      expect(result.completenessScore).toBe(97);
      expect(result.discoveryConfidenceScore).toBe(63);
      expect(result.readinessBand).toBe('strong');
      expect(result.missingRequiredCount).toBe(0);
      expect(result.criticalGapCount).toBe(0);
    });

    it('scores a minimal valid profile at the floor', () => {
      const result = calculateBusinessDiscoveryCompleteness(MINIMAL_PROFILE);
      expect(result.completenessScore).toBe(6);
      expect(result.discoveryConfidenceScore).toBe(0);
      expect(result.readinessBand).toBe('incomplete');
    });

    it('scores a complete but entirely unevidenced profile', () => {
      const result = calculateBusinessDiscoveryCompleteness(ZERO_EVIDENCE_COMPLETE_PROFILE);
      // Nearly complete capture...
      expect(result.completenessScore).toBe(93);
      // ...but confidence is capped, because none of it is evidenced.
      expect(result.discoveryConfidenceScore).toBe(35);
      // ...so it is emphatically not "strong".
      expect(result.readinessBand).toBe('partial');
      expect(result.reasons).toContain('no-evidence-sources');
      expect(result.reasons).toContain('confidence-capped:no-evidence');
    });

    it('scores a profile whose evidence is listed but never cited', () => {
      const result = calculateBusinessDiscoveryCompleteness(LISTED_BUT_UNCITED_PROFILE);
      expect(result.completenessScore).toBe(97);
      // Capped: nominal evidence is barely better than none.
      expect(result.discoveryConfidenceScore).toBe(45);
      expect(result.readinessBand).toBe('usable');
    });

    it('scores a profile with a missing required/critical area', () => {
      const result = calculateBusinessDiscoveryCompleteness(MISSING_CRITICAL_PROFILE);
      expect(result.completenessScore).toBe(87);
      expect(result.discoveryConfidenceScore).toBe(51);
      expect(result.readinessBand).toBe('partial');
      expect(result.criticalGapCount).toBe(1);
      expect(result.missingRequiredCount).toBe(1);
    });
  });

  describe('completeness score', () => {
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
      expect(base.completenessScore).toBe(97);
      expect(one.completenessScore).toBe(92);
      expect(two.completenessScore).toBe(87);
    });
  });

  describe('discovery input confidence', () => {
    it('does not simply mirror the completeness score', () => {
      const result = calculateBusinessDiscoveryCompleteness(ZERO_EVIDENCE_COMPLETE_PROFILE);
      // 93 vs 35 — the two numbers measure genuinely different things.
      expect(result.completenessScore - result.discoveryConfidenceScore).toBeGreaterThanOrEqual(50);
    });

    it('caps confidence when there are no evidence sources at all', () => {
      const result = calculateBusinessDiscoveryCompleteness(ZERO_EVIDENCE_COMPLETE_PROFILE);
      expect(result.discoveryConfidenceScore).toBeLessThanOrEqual(35);
      expect(result.readinessBand).not.toBe('strong');
      expect(result.readinessBand).not.toBe('usable');
    });

    it('rises materially once evidence signals exist', () => {
      const unevidenced = calculateBusinessDiscoveryCompleteness(ZERO_EVIDENCE_COMPLETE_PROFILE);
      const evidenced = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      // Same structured content; the sample's advantage is its evidence.
      expect(evidenced.discoveryConfidenceScore).toBe(63);
      expect(unevidenced.discoveryConfidenceScore).toBe(35);
      expect(
        evidenced.discoveryConfidenceScore - unevidenced.discoveryConfidenceScore,
      ).toBeGreaterThanOrEqual(25);
    });

    it('rewards evidence that is actually cited over evidence merely listed', () => {
      const listedOnly = calculateBusinessDiscoveryCompleteness(LISTED_BUT_UNCITED_PROFILE);
      const cited = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      expect(listedOnly.reasons).toContain('evidence-sources-unlinked');
      expect(cited.reasons).toContain('evidence-backed');
      expect(cited.discoveryConfidenceScore).toBe(63);
      expect(listedOnly.discoveryConfidenceScore).toBe(45);
    });

    it('caps uncited evidence and surfaces it as a limiting reason', () => {
      const result = calculateBusinessDiscoveryCompleteness(LISTED_BUT_UNCITED_PROFILE);
      expect(result.discoveryConfidenceScore).toBeLessThanOrEqual(45);
      expect(result.reasons).toContain('confidence-capped:uncited-evidence');
      expect(result.reasons).toContain('evidence-sources-unlinked');
      expect(result.readinessBand).not.toBe('strong');
    });

    it('does not let extra uncited sources buy any confidence', () => {
      const three = calculateBusinessDiscoveryCompleteness(LISTED_BUT_UNCITED_PROFILE);
      const eight = calculateBusinessDiscoveryCompleteness(UNCITED_MANY_SOURCES_PROFILE);
      expect(eight.evidenceReferenceCount).toBe(8);
      expect(three.evidenceReferenceCount).toBe(3);
      // Padding the list changes nothing once the cap binds.
      expect(eight.discoveryConfidenceScore).toBe(three.discoveryConfidenceScore);
      expect(eight.discoveryConfidenceScore).toBe(45);
      expect(eight.readinessBand).toBe('usable');
    });

    it('ranks one genuinely cited source above eight uncited ones', () => {
      const citedOnce = calculateBusinessDiscoveryCompleteness(CITED_SINGLE_SOURCE_PROFILE);
      const uncitedEight = calculateBusinessDiscoveryCompleteness(UNCITED_MANY_SOURCES_PROFILE);
      expect(citedOnce.evidenceReferenceCount).toBe(1);
      expect(uncitedEight.evidenceReferenceCount).toBe(8);
      // Citing beats listing, even at 1 source against 8.
      expect(citedOnce.discoveryConfidenceScore).toBe(52);
      expect(uncitedEight.discoveryConfidenceScore).toBe(45);
      expect(citedOnce.discoveryConfidenceScore).toBeGreaterThan(
        uncitedEight.discoveryConfidenceScore,
      );
    });

    it('drops when critical gaps are present', () => {
      const full = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      const gapped = calculateBusinessDiscoveryCompleteness(MISSING_CRITICAL_PROFILE);
      expect(gapped.criticalGapCount).toBe(1);
      expect(gapped.discoveryConfidenceScore).toBeLessThan(full.discoveryConfidenceScore);
    });

    it('gives assumptions alone no confidence whatsoever', () => {
      const assumptionsOnly = calculateBusinessDiscoveryCompleteness({
        ...MINIMAL_PROFILE,
        assumptions: Array.from({ length: 25 }, (_, index) => ({
          id: `assumption-${index}`,
          statement: `Unverified statement ${index}`,
          confidence: 'high' as const,
        })),
      });
      expect(assumptionsOnly.assumptionCount).toBe(25);
      expect(assumptionsOnly.discoveryConfidenceScore).toBe(0);
      expect(assumptionsOnly.readinessBand).toBe('incomplete');
    });

    it('caps the assumption transparency credit so assumptions cannot inflate', () => {
      const none = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        assumptions: [],
      });
      const many = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        assumptions: Array.from({ length: 40 }, (_, index) => ({
          id: `assumption-${index}`,
          statement: `Unverified statement ${index}`,
          confidence: 'high' as const,
        })),
      });
      expect(many.assumptionCount).toBe(40);
      expect(many.discoveryConfidenceScore - none.discoveryConfidenceScore).toBeLessThanOrEqual(5);
    });

    it('penalises low-confidence assumptions rather than rewarding them', () => {
      const high = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        assumptions: [{ id: 'a1', statement: 'Stated assumption', confidence: 'high' }],
      });
      const low = calculateBusinessDiscoveryCompleteness({
        ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        assumptions: [{ id: 'a1', statement: 'Stated assumption', confidence: 'low' }],
      });
      expect(low.discoveryConfidenceScore).toBeLessThan(high.discoveryConfidenceScore);
    });
  });

  describe('readiness band transitions', () => {
    it('bands a complete, evidenced, gap-free profile as strong', () => {
      expect(
        calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE).readinessBand,
      ).toBe('strong');
    });

    it('demotes to partial on an open critical gap despite high completeness', () => {
      const result = calculateBusinessDiscoveryCompleteness(MISSING_CRITICAL_PROFILE);
      expect(result.completenessScore).toBe(87); // would band `usable` on completeness alone
      expect(result.readinessBand).toBe('partial');
    });

    it('demotes on low input confidence despite high completeness', () => {
      const result = calculateBusinessDiscoveryCompleteness(ZERO_EVIDENCE_COMPLETE_PROFILE);
      expect(result.completenessScore).toBe(93); // would band `strong` on completeness alone
      expect(result.discoveryConfidenceScore).toBe(35); // below the 40 floor
      expect(result.readinessBand).toBe('partial');
    });

    it('demotes to usable on uncited evidence despite 97 completeness', () => {
      const result = calculateBusinessDiscoveryCompleteness(LISTED_BUT_UNCITED_PROFILE);
      expect(result.completenessScore).toBe(97); // would band `strong` on completeness alone
      expect(result.discoveryConfidenceScore).toBe(45); // between the 40 and 60 floors
      expect(result.readinessBand).toBe('usable');
    });

    it('bands an empty profile as incomplete', () => {
      expect(calculateBusinessDiscoveryCompleteness(MINIMAL_PROFILE).readinessBand).toBe(
        'incomplete',
      );
    });
  });

  describe('section weights and totalWeight', () => {
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

    it('reports totalWeight as exactly 100 for the full default questionnaire', () => {
      const result = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      expect(result.breakdown.totalWeight).toBe(100);
      expect(result.breakdown.sections).toHaveLength(
        DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.length,
      );
    });

    it('computes totalWeight from the reported weights, never asserting 100', () => {
      // Rounding each normalized weight to two decimals means some subsets do
      // not land on exactly 100. The reported total must tell the truth.
      const expectedBySectionCount: Readonly<Record<number, number>> = {
        4: 99.99,
        7: 100.01,
        8: 99.99,
      };

      for (
        let count = 1;
        count <= DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.length;
        count++
      ) {
        const subset: BusinessDiscoveryQuestionnaire = {
          ...DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
          sections: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.slice(0, count),
        };
        const result = calculateBusinessDiscoveryCompleteness(
          SAMPLE_BUSINESS_DISCOVERY_PROFILE,
          subset,
        );
        const actualSum =
          Math.round(result.breakdown.sections.reduce((sum, s) => sum + s.weight, 0) * 100) / 100;

        expect(result.breakdown.sections).toHaveLength(count);
        expect(result.breakdown.totalWeight, `totalWeight for ${count} section(s)`).toBe(actualSum);
        expect(result.breakdown.totalWeight).toBe(expectedBySectionCount[count] ?? 100);
      }
    });

    it('normalizes a subset questionnaire so a fully-answered subset still scores 100', () => {
      const subset: BusinessDiscoveryQuestionnaire = {
        ...DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
        sections: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.slice(0, 3),
      };
      const result = calculateBusinessDiscoveryCompleteness(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        subset,
      );
      expect(result.completenessScore).toBe(100);
      expect(result.breakdown.totalWeight).toBe(100);
    });

    it('rejects a questionnaire with no sections at the schema boundary', () => {
      // The zero-applicable-section case cannot reach the scorer: the
      // questionnaire schema requires at least one section.
      const empty = { ...DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, sections: [] };
      expect(() =>
        calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE, empty),
      ).toThrow(/questionnaire/i);
    });
  });

  describe('clamping and shape', () => {
    it('always clamps both scores to 0-100', () => {
      const profiles: readonly BusinessDiscoveryProfile[] = [
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        MINIMAL_PROFILE,
        ZERO_EVIDENCE_COMPLETE_PROFILE,
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
      expect(result.evidenceReferenceCount).toBe(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE.evidenceSources.length,
      );
      expect(result.assumptionCount).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.assumptions.length);
      expect(result.reasons.length).toBeGreaterThan(0);
      for (const reason of result.reasons) {
        expect(reason).toMatch(/^[a-z0-9-]+(:[a-z0-9-]+)?$/);
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
      expect(packageEntrypoint.readinessBandSchema).toBeDefined();
    });
  });
});
