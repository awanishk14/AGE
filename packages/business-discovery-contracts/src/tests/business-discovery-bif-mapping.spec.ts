import { describe, expect, it } from 'vitest';
import {
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  businessDiscoveryProfileSchema,
  bifCompatibleBusinessContextSchema,
  mapBusinessDiscoveryToBifContext,
  validateProfileAgainstQuestionnaire,
  BIF_COMPATIBLE_SECTION_KEYS,
} from '../index';
import type { BusinessDiscoveryProfile, BifCompatibleBusinessContext } from '../index';

/** Minimal valid profile: only the required core fields populated. */
function buildMinimalProfile(
  overrides: Partial<BusinessDiscoveryProfile> = {},
): BusinessDiscoveryProfile {
  return {
    id: 'profile-min',
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
    capturedAt: '2026-07-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('@age/business-discovery-contracts — sample profile fixture', () => {
  it('parses with the existing profile schema', () => {
    expect(
      businessDiscoveryProfileSchema.safeParse(SAMPLE_BUSINESS_DISCOVERY_PROFILE).success,
    ).toBe(true);
  });

  it('passes questionnaire validation against the default questionnaire', () => {
    const result = validateProfileAgainstQuestionnaire(
      SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
    );
    expect(result.valid).toBe(true);
    expect(result.missingRequiredQuestionIds).toHaveLength(0);
  });

  it('populates every discovery concept', () => {
    const p = SAMPLE_BUSINESS_DISCOVERY_PROFILE;
    expect(p.industry).toBeTruthy();
    expect(p.businessModel).toBeTruthy();
    expect(p.brandPositioning).toBeTruthy();
    expect(p.segments.length).toBeGreaterThan(0);
    expect(p.offerings.length).toBeGreaterThan(0);
    expect(p.competitors.length).toBeGreaterThan(0);
    expect(p.goals.length).toBeGreaterThan(0);
    expect(p.constraints.length).toBeGreaterThan(0);
    expect(p.assets.length).toBeGreaterThan(0);
    expect(p.evidenceSources.length).toBeGreaterThan(0);
    expect(p.assumptions.length).toBeGreaterThan(0);
    expect(p.gaps.length).toBeGreaterThan(0);
  });
});

describe('@age/business-discovery-contracts — BIF-compatible mapping', () => {
  it('produces schema-valid, BIF-compatible output', () => {
    const context = mapBusinessDiscoveryToBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
    expect(bifCompatibleBusinessContextSchema.safeParse(context).success).toBe(true);
  });

  it('carries organization identity through verbatim', () => {
    const context = mapBusinessDiscoveryToBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
    expect(context.organizationIdentity.name).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.businessName);
    expect(context.organizationIdentity.industry).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.industry);
    expect(context.organizationIdentity.businessModel).toBe(
      SAMPLE_BUSINESS_DISCOVERY_PROFILE.businessModel,
    );
    expect(context.organizationIdentity.brandPositioning).toBe(
      SAMPLE_BUSINESS_DISCOVERY_PROFILE.brandPositioning,
    );
    expect(context.sourceProfileId).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.id);
    expect(context.capturedAt).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.capturedAt);
  });

  it('maps offerings, customer segments and competitors', () => {
    const context = mapBusinessDiscoveryToBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
    expect(context.offerings).toEqual(SAMPLE_BUSINESS_DISCOVERY_PROFILE.offerings);
    expect(context.customerSegments).toEqual(SAMPLE_BUSINESS_DISCOVERY_PROFILE.segments);
    expect(context.marketCompetition.competitors).toEqual(
      SAMPLE_BUSINESS_DISCOVERY_PROFILE.competitors,
    );
    expect(context.marketCompetition.geographies).toEqual(
      SAMPLE_BUSINESS_DISCOVERY_PROFILE.geographies,
    );
  });

  it('maps goals, constraints, assumptions, gaps and evidence references', () => {
    const context = mapBusinessDiscoveryToBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
    expect(context.goals).toEqual(SAMPLE_BUSINESS_DISCOVERY_PROFILE.goals);
    expect(context.constraints).toEqual(SAMPLE_BUSINESS_DISCOVERY_PROFILE.constraints);
    expect(context.assumptions).toEqual(SAMPLE_BUSINESS_DISCOVERY_PROFILE.assumptions);
    expect(context.gaps).toEqual(SAMPLE_BUSINESS_DISCOVERY_PROFILE.gaps);
    expect(context.evidenceSources).toEqual(SAMPLE_BUSINESS_DISCOVERY_PROFILE.evidenceSources);
    expect(context.assets).toEqual(SAMPLE_BUSINESS_DISCOVERY_PROFILE.assets);
    expect(context.marketingChannels).toEqual(SAMPLE_BUSINESS_DISCOVERY_PROFILE.marketingChannels);
  });

  it('is deterministic — identical input yields deep-equal output', () => {
    const first = mapBusinessDiscoveryToBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
    const second = mapBusinessDiscoveryToBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
    expect(first).toEqual(second);
  });

  it('does not mutate the input profile', () => {
    const snapshot = JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
    mapBusinessDiscoveryToBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
    expect(JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE)).toBe(snapshot);
  });

  it('returns fresh arrays that do not alias the input collections', () => {
    const context = mapBusinessDiscoveryToBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
    expect(context.offerings).not.toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.offerings);
    expect(context.goals).not.toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.goals);
  });

  it('maps a minimal valid profile safely, omitting absent optional identity fields', () => {
    const context = mapBusinessDiscoveryToBifContext(buildMinimalProfile());
    expect(bifCompatibleBusinessContextSchema.safeParse(context).success).toBe(true);
    expect(context.organizationIdentity.name).toBe('Minimal Co');
    expect(context.organizationIdentity.industry).toBeUndefined();
    expect(context.organizationIdentity.businessModel).toBeUndefined();
    expect(context.customerSegments).toEqual([]);
    expect(context.offerings).toEqual([]);
  });

  it('rejects an invalid profile at the schema boundary before mapping', () => {
    const invalid = { ...buildMinimalProfile(), businessName: '' };
    const parsed = businessDiscoveryProfileSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    // Mapping is only performed on parsed/valid profiles; the schema is the gate.
  });

  it('exposes BIF-aligned section keys mirroring @age/bif SectionType values', () => {
    expect(BIF_COMPATIBLE_SECTION_KEYS.organizationIdentity).toBe('organization_identity');
    expect(BIF_COMPATIBLE_SECTION_KEYS.productsServices).toBe('products_services');
    expect(BIF_COMPATIBLE_SECTION_KEYS.icpPersonas).toBe('icp_personas');
    expect(BIF_COMPATIBLE_SECTION_KEYS.marketCompetition).toBe('market_competition');
  });
});

describe('@age/business-discovery-contracts — PR3 entrypoint exports', () => {
  it('resolves the sample fixture, mapper and projection schema from the index', () => {
    expect(typeof mapBusinessDiscoveryToBifContext).toBe('function');
    expect(typeof bifCompatibleBusinessContextSchema.safeParse).toBe('function');
    const context: BifCompatibleBusinessContext = mapBusinessDiscoveryToBifContext(
      SAMPLE_BUSINESS_DISCOVERY_PROFILE,
    );
    expect(context.organizationIdentity.name).toBeTruthy();
  });
});
