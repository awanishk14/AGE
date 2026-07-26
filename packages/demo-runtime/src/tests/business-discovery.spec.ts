import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  businessDiscoveryProfileSchema,
  produceScoredBifContext,
} from '@age/business-discovery-contracts';
import { runBusinessDiscoveryIntake } from '../business-discovery';
import { DEMO_SCENARIO_METADATA } from '../demo-scenario-metadata';
import { runAllCapabilities } from '../capabilities';

/**
 * Business Discovery is an upstream *intake* stage of the demo — it captures and
 * normalizes business context. It is deliberately NOT a capability run: it
 * produces no decision objects, so it never enters the capability approval
 * model. These tests pin that separation, the summary contents, and the
 * ADR-0038 / ADR-0039 mapping-path rules.
 */

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const INTAKE_SOURCE = readFileSync(join(MODULE_DIRECTORY, '..', 'business-discovery.ts'), 'utf8');
const SCENARIO_SOURCE = readFileSync(
  join(MODULE_DIRECTORY, '..', 'demo-scenario-metadata.ts'),
  'utf8',
);

/** Doc comments legitimately name Path A while saying it is no longer used. */
function withoutComments(source: string): string {
  return source.replace(/\/\*\*[\s\S]*?\*\/|\/\/.*$/gm, '');
}

describe('Business Discovery demo intake', () => {
  it('loads the sample profile and reports its identity', () => {
    const summary = runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
    expect(summary.profileId).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.id);
    expect(summary.businessName).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.businessName);
  });

  it('validates the sample profile against businessDiscoveryProfileSchema', () => {
    const summary = runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
    expect(summary.profileSchemaValid).toBe(true);
    // Independent confirmation that the flag is not merely hard-coded.
    expect(
      businessDiscoveryProfileSchema.safeParse(SAMPLE_BUSINESS_DISCOVERY_PROFILE).success,
    ).toBe(true);
  });

  it('includes the questionnaire validation result for the default questionnaire', () => {
    const summary = runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
    expect(summary.questionnaireId).toBe(DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.id);
    expect(summary.questionnaireVersion).toBe(DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.version);
    expect(summary.questionnaireValid).toBe(true);
    expect(summary.missingRequiredCount).toBe(0);
    expect(summary.criticalGapCount).toBe(0);
  });

  it('reports the canonical sections Path B populated and those it omitted', () => {
    const summary = runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);

    // The honest Path B result on the sample profile: 7 of the 12 canonical BIF
    // sections are populated and 5 are omitted. Path A previously reported 8
    // locally-invented grouping keys and no omissions at all.
    expect(summary.presentSectionTypes).toEqual([
      'organization_identity',
      'vision_strategy',
      'products_services',
      'icp_personas',
      'market_competition',
      'brand_system',
      'gtm_system',
    ]);
    expect(summary.omittedSectionTypes).toHaveLength(5);
    expect(summary.presentSectionTypes.length + summary.omittedSectionTypes.length).toBe(12);

    // Omitted sections are reported as absent, never invented into present ones.
    for (const type of summary.omittedSectionTypes) {
      expect(summary.presentSectionTypes).not.toContain(type);
    }
  });

  it('matches produceScoredBifContext called directly — the demo adds no mapping of its own', () => {
    const summary = runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
    const { context } = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
      organizationId: DEMO_SCENARIO_METADATA.organizationId,
      constructedAt: DEMO_SCENARIO_METADATA.constructedAt,
      changedBy: DEMO_SCENARIO_METADATA.changedBy,
    });

    expect(summary.presentSectionTypes).toEqual(context.sections.map((s) => String(s.type)));
    expect(summary.omittedSectionTypes).toEqual(context.omittedSections.map((s) => String(s.type)));
    // The BIF is never promoted by the demo.
    expect(context.bifStatus).toBe('Draft');
  });

  it('reports compact counts only — no full profile payload is exposed', () => {
    const summary = runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
    expect(summary.evidenceReferenceCount).toBe(
      SAMPLE_BUSINESS_DISCOVERY_PROFILE.evidenceSources.length,
    );
    expect(summary.assumptionCount).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.assumptions.length);
    expect(summary.goalCount).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.goals.length);
    expect(summary.offeringCount).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.offerings.length);
    expect(summary.customerSegmentCount).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.segments.length);
    expect(summary.competitorCount).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.competitors.length);

    // Compactness guard: the summary carries scalars/keys only — never nested
    // profile objects (segment/offering/evidence bodies, answers, URLs).
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('http');
    for (const [key, value] of Object.entries(summary)) {
      const isScalar =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
      const isStringList = Array.isArray(value) && value.every((v) => typeof v === 'string');
      expect(isScalar || isStringList, `summary.${key} must be a scalar or string list`).toBe(true);
    }
  });

  it('is deterministic across runs', () => {
    expect(runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA)).toEqual(
      runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA),
    );
  });

  it('does not mutate the sample profile fixture', () => {
    const before = JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
    runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
    runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
    expect(JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE)).toBe(before);
  });

  it('leaves the existing six-capability demo output completely intact', async () => {
    runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
    const reports = await runAllCapabilities();
    expect(reports).toHaveLength(6);
    expect(reports.map((r) => r.name)).toEqual([
      'Intelligence',
      'Market Discovery',
      'Growth',
      'Authority',
      'Operations',
      'Revenue',
    ]);
    const pending = reports.reduce((sum, r) => sum + r.acceptedItems.length, 0);
    expect(pending).toBe(6);
  });

  it('produces no decision objects — intake never enters the approval model', () => {
    const summary = runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
    expect(summary).not.toHaveProperty('acceptedItems');
    expect(summary).not.toHaveProperty('acceptedCount');
    expect(summary).not.toHaveProperty('executionResult');
  });
});

describe('ADR-0039 — demo scenario metadata is explicit and demo-owned', () => {
  it('supplies exactly the three values canonical Path B requires', () => {
    expect(Object.keys(DEMO_SCENARIO_METADATA).sort()).toEqual([
      'changedBy',
      'constructedAt',
      'organizationId',
    ]);
    expect(DEMO_SCENARIO_METADATA.organizationId.trim().length).toBeGreaterThan(0);
    expect(DEMO_SCENARIO_METADATA.changedBy.trim().length).toBeGreaterThan(0);
    expect(Number.isNaN(DEMO_SCENARIO_METADATA.constructedAt.getTime())).toBe(false);
  });

  it('declares a fixed scenario time, never a wall-clock read', () => {
    expect(withoutComments(SCENARIO_SOURCE)).not.toMatch(/new Date\(\s*\)/);
    expect(withoutComments(SCENARIO_SOURCE)).not.toMatch(/Date\.now\(/);
    expect(DEMO_SCENARIO_METADATA.constructedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('labels itself demo scenario metadata, not production tenant identity', () => {
    expect(SCENARIO_SOURCE).toMatch(/NOT PRODUCTION TENANT IDENTITY/i);
    expect(SCENARIO_SOURCE).toMatch(/ADR-0039/);
  });

  it('is passed in, not reached for — the intake stage invents none of the three', () => {
    const source = withoutComments(INTAKE_SOURCE);
    expect(source).not.toMatch(/DEMO_SCENARIO_METADATA/);
    expect(source).not.toMatch(/new Date\(/);
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    // Every one of the three reaches the mapper from the parameter.
    expect(source).toMatch(/scenario\.organizationId/);
    expect(source).toMatch(/scenario\.constructedAt/);
    expect(source).toMatch(/scenario\.changedBy/);
  });

  it('uses canonical Path B and no longer calls legacy Path A', () => {
    const source = withoutComments(INTAKE_SOURCE);
    expect(source).toMatch(/produceScoredBifContext/);
    expect(source).not.toMatch(/mapBusinessDiscoveryToBifContext/);
    expect(source).not.toMatch(/BifCompatibleBusinessContext/);
  });

  it('changing the scenario changes only what the scenario owns', () => {
    const other = {
      organizationId: 'other-demo-organization',
      constructedAt: new Date('2025-06-15T12:30:00.000Z'),
      changedBy: 'other-demo-operator',
    };

    const baseline = runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
    const alternative = runBusinessDiscoveryIntake(other);

    // The metadata is genuinely threaded through, but it describes provenance —
    // it must not change which sections the discovery input can populate.
    expect(alternative.presentSectionTypes).toEqual(baseline.presentSectionTypes);
    expect(alternative.omittedSectionTypes).toEqual(baseline.omittedSectionTypes);
  });
});
