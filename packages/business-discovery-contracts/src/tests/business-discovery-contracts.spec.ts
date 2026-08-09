import { describe, expect, it } from 'vitest';
import {
  businessDiscoveryProfileSchema,
  businessGoalSchema,
  businessAssumptionSchema,
  competitorReferenceSchema,
  customerSegmentSchema,
  offeringSchema,
  discoveryGapSchema,
  discoverySectionIdSchema,
  DISCOVERY_SECTION_IDS,
  STATED_ANSWER_PROVENANCE,
} from '../index';
import type {
  BusinessDiscoveryProfile,
  BusinessGoal,
  BusinessAssumption,
  CompetitorReference,
  CustomerSegment,
  DiscoveryGap,
  Offering,
} from '../index';

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

describe('@age/business-discovery-contracts — profile validation', () => {
  it('parses a valid minimal BusinessDiscoveryProfile', () => {
    const result = businessDiscoveryProfileSchema.safeParse(buildProfile());
    expect(result.success).toBe(true);
  });

  it('parses a richly populated profile with every sub-model represented', () => {
    const profile = buildProfile({
      industry: 'B2B SaaS',
      businessModel: 'subscription',
      geographies: ['US', 'EU'],
      marketingChannels: ['SEO', 'email'],
      brandPositioning: 'the reliable CRM for small teams',
      segments: [{ id: 'seg-1', name: 'SMB sales teams', industry: 'software' }],
      offerings: [{ id: 'off-1', name: 'CRM Pro', type: 'service', valueProposition: 'save time' }],
      competitors: [{ id: 'comp-1', name: 'BigCRM', note: 'enterprise incumbent' }],
      goals: [{ id: 'goal-1', statement: 'double MRR', horizon: 'medium' }],
      constraints: ['limited marketing budget'],
      assets: ['existing email list'],
      evidenceSources: [{ id: 'ev-1', label: 'Kickoff call', kind: 'client-statement' }],
      assumptions: [{ id: 'asm-1', statement: 'buyers are founders', confidence: 'medium' }],
      gaps: [
        { id: 'gap-1', sectionId: 'customers-icp', missing: 'company size', severity: 'important' },
      ],
      sections: [
        {
          id: 'business-identity',
          name: 'Business Identity',
          questions: [
            {
              id: 'q-1',
              sectionId: 'business-identity',
              prompt: 'Business name?',
              required: true,
              kind: 'text',
            },
          ],
          answers: [
            {
              questionId: 'q-1',
              value: 'Acme CRM',
              provenance: STATED_ANSWER_PROVENANCE,
              evidenceSourceIds: ['ev-1'],
            },
          ],
        },
      ],
    });
    const result = businessDiscoveryProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
  });

  it('enforces the required core field businessName', () => {
    const { businessName: _omit, ...withoutName } = buildProfile();
    expect(businessDiscoveryProfileSchema.safeParse(withoutName).success).toBe(false);
  });

  it('rejects an empty businessName', () => {
    expect(
      businessDiscoveryProfileSchema.safeParse(buildProfile({ businessName: '' })).success,
    ).toBe(false);
  });

  it('enforces the required core field id', () => {
    const { id: _omit, ...withoutId } = buildProfile();
    expect(businessDiscoveryProfileSchema.safeParse(withoutId).success).toBe(false);
  });

  it('rejects a non-ISO capturedAt timestamp', () => {
    expect(
      businessDiscoveryProfileSchema.safeParse(buildProfile({ capturedAt: 'not-a-date' })).success,
    ).toBe(false);
  });

  it('rejects unknown top-level keys are not silently required (extra allowed, missing rejected)', () => {
    // Core required lists must be present.
    const { gaps: _omit, ...withoutGaps } = buildProfile();
    expect(businessDiscoveryProfileSchema.safeParse(withoutGaps).success).toBe(false);
  });
});

describe('@age/business-discovery-contracts — sub-model validation', () => {
  it('represents a discovery gap and rejects an invalid severity', () => {
    const gap: DiscoveryGap = {
      id: 'gap-1',
      sectionId: 'market-competition',
      missing: 'top competitors',
      severity: 'critical',
    };
    expect(discoveryGapSchema.safeParse(gap).success).toBe(true);
    expect(discoveryGapSchema.safeParse({ ...gap, severity: 'blocker' }).success).toBe(false);
  });

  it('represents an assumption and rejects an invalid confidence band', () => {
    const asm: BusinessAssumption = {
      id: 'asm-1',
      statement: 'buyers are technical',
      confidence: 'high',
    };
    expect(businessAssumptionSchema.safeParse(asm).success).toBe(true);
    expect(businessAssumptionSchema.safeParse({ ...asm, confidence: 'certain' }).success).toBe(
      false,
    );
  });

  it('represents a goal with an optional horizon', () => {
    const goal: BusinessGoal = { id: 'goal-1', statement: 'expand to EU' };
    expect(businessGoalSchema.safeParse(goal).success).toBe(true);
    expect(businessGoalSchema.safeParse({ ...goal, horizon: 'yearly' }).success).toBe(false);
  });

  it('represents an offering and rejects an invalid type', () => {
    const offering: Offering = { id: 'off-1', name: 'CRM Pro', type: 'product' };
    expect(offeringSchema.safeParse(offering).success).toBe(true);
    expect(offeringSchema.safeParse({ ...offering, type: 'subscription' }).success).toBe(false);
  });

  it('represents an ICP / customer segment with only id and name required', () => {
    const segment: CustomerSegment = { id: 'seg-1', name: 'SMB teams' };
    expect(customerSegmentSchema.safeParse(segment).success).toBe(true);
    expect(customerSegmentSchema.safeParse({ id: 'seg-2' }).success).toBe(false);
  });

  it('represents a competitor reference', () => {
    const competitor: CompetitorReference = { id: 'comp-1', name: 'BigCRM' };
    expect(competitorReferenceSchema.safeParse(competitor).success).toBe(true);
    expect(competitorReferenceSchema.safeParse({ id: 'comp-2', name: '' }).success).toBe(false);
  });

  it('accepts every declared discovery section id', () => {
    for (const id of DISCOVERY_SECTION_IDS) {
      expect(discoverySectionIdSchema.safeParse(id).success).toBe(true);
    }
    expect(discoverySectionIdSchema.safeParse('unknown-section').success).toBe(false);
    expect(DISCOVERY_SECTION_IDS).toHaveLength(9);
  });
});

describe('@age/business-discovery-contracts — package entrypoint', () => {
  it('re-exports schemas and enum constants from the index', () => {
    expect(typeof businessDiscoveryProfileSchema.safeParse).toBe('function');
    expect(Array.isArray(DISCOVERY_SECTION_IDS)).toBe(true);
  });
});
