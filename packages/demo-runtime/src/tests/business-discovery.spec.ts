import { describe, expect, it } from 'vitest';
import {
  BIF_COMPATIBLE_SECTION_KEYS,
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  businessDiscoveryProfileSchema,
} from '@age/business-discovery-contracts';
import { runBusinessDiscoveryIntake } from '../business-discovery';
import { runAllCapabilities } from '../capabilities';

/**
 * Business Discovery is an upstream *intake* stage of the demo — it captures and
 * normalizes business context. It is deliberately NOT a capability run: it
 * produces no decision objects, so it never enters the capability approval
 * model. These tests pin that separation as well as the summary contents.
 */
describe('Business Discovery demo intake', () => {
  it('loads the sample profile and reports its identity', () => {
    const summary = runBusinessDiscoveryIntake();
    expect(summary.profileId).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.id);
    expect(summary.businessName).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.businessName);
  });

  it('validates the sample profile against businessDiscoveryProfileSchema', () => {
    const summary = runBusinessDiscoveryIntake();
    expect(summary.profileSchemaValid).toBe(true);
    // Independent confirmation that the flag is not merely hard-coded.
    expect(
      businessDiscoveryProfileSchema.safeParse(SAMPLE_BUSINESS_DISCOVERY_PROFILE).success,
    ).toBe(true);
  });

  it('includes the questionnaire validation result for the default questionnaire', () => {
    const summary = runBusinessDiscoveryIntake();
    expect(summary.questionnaireId).toBe(DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.id);
    expect(summary.questionnaireVersion).toBe(DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.version);
    expect(summary.questionnaireValid).toBe(true);
    expect(summary.missingRequiredCount).toBe(0);
    expect(summary.criticalGapCount).toBe(0);
  });

  it('includes a BIF-compatible projection summary of populated section keys', () => {
    const summary = runBusinessDiscoveryIntake();
    // The fully-populated sample fixture exercises every projection section.
    expect(summary.mappedSectionKeys).toEqual(Object.values(BIF_COMPATIBLE_SECTION_KEYS));
  });

  it('reports compact counts only — no full profile payload is exposed', () => {
    const summary = runBusinessDiscoveryIntake();
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
    expect(runBusinessDiscoveryIntake()).toEqual(runBusinessDiscoveryIntake());
  });

  it('does not mutate the sample profile fixture', () => {
    const before = JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
    runBusinessDiscoveryIntake();
    runBusinessDiscoveryIntake();
    expect(JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE)).toBe(before);
  });

  it('leaves the existing six-capability demo output completely intact', async () => {
    runBusinessDiscoveryIntake();
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
    const summary = runBusinessDiscoveryIntake();
    expect(summary).not.toHaveProperty('acceptedItems');
    expect(summary).not.toHaveProperty('acceptedCount');
    expect(summary).not.toHaveProperty('executionResult');
  });
});
