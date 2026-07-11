import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { scoreRevenuePlanCandidate } from '../../processing/score-revenue-plan-candidate';
import type { RevenuePlanCandidate } from '../../processing/revenue-plan-candidate';

function buildCandidate(overrides: Partial<RevenuePlanCandidate> = {}): RevenuePlanCandidate {
  return {
    revenuePlanId: 'rev-plan-1',
    planType: 'UPSELL',
    target: { kind: 'ACCOUNT', key: 'account:acme' },
    executionDomains: [ExecutionDomain.CRM],
    expectedValue: 80,
    conversionProbability: 50,
    retentionRisk: 40,
    estimatedEffort: 40,
    confidence: 70,
    sourceRefs: [{ referenceId: 'ops-1', referenceType: 'OPERATIONS_PLAN' }],
    ...overrides,
  };
}

describe('scoreRevenuePlanCandidate', () => {
  it('computes the known worked example (value 80, conversion 50, risk 40, effort 40, confidence 70)', () => {
    // valueRiskBlend = round(0.7*80 + 0.3*40) = 68
    // pwRevenueScore = round(68*50/100) = 34
    // revenueImpact  = round(34*(0.7 + 0.3*70/100)) = round(34*0.91) = 31
    // priorityScore  = round(0.7*31 + 0.3*(100-40)) = round(21.7+18) = 40 -> MEDIUM
    const score = scoreRevenuePlanCandidate(buildCandidate());
    expect(score).toEqual({
      revenueImpactScore: 31,
      valueBand: 'LOW',
      effortScore: 40,
      effortBand: 'MEDIUM',
      confidenceScore: 70,
      priority: 'MEDIUM',
    });
  });

  it('forces revenueImpactScore to 0 when conversionProbability is 0, regardless of confidence', () => {
    const score = scoreRevenuePlanCandidate(
      buildCandidate({
        expectedValue: 100,
        conversionProbability: 0,
        retentionRisk: 100,
        confidence: 100,
      }),
    );
    expect(score.revenueImpactScore).toBe(0);
    expect(score.valueBand).toBe('LOW');
  });

  it('does not let confidence manufacture impact when conversion is zero', () => {
    const lowConf = scoreRevenuePlanCandidate(
      buildCandidate({ conversionProbability: 0, confidence: 0 }),
    );
    const highConf = scoreRevenuePlanCandidate(
      buildCandidate({ conversionProbability: 0, confidence: 100 }),
    );
    expect(lowConf.revenueImpactScore).toBe(0);
    expect(highConf.revenueImpactScore).toBe(0);
  });

  it('clamps below 0 to 0 and above 100 to 100; non-finite to 0', () => {
    const high = scoreRevenuePlanCandidate(
      buildCandidate({
        expectedValue: 150,
        conversionProbability: 150,
        retentionRisk: 150,
        estimatedEffort: -10,
        confidence: 150,
      }),
    );
    expect(high.effortScore).toBe(0);
    expect(high.confidenceScore).toBe(100);
    expect(high.revenueImpactScore).toBe(100); // blend 100, pwrs 100, impact round(100*1.0)=100
    expect(high.priority).toBe('HIGH');

    const nonFinite = scoreRevenuePlanCandidate(
      buildCandidate({
        expectedValue: Number.NaN,
        conversionProbability: Number.POSITIVE_INFINITY,
      }),
    );
    // expectedValue -> 0, conversion -> 0 => impact 0
    expect(nonFinite.revenueImpactScore).toBe(0);
  });

  it('ignores monetaryAmount and currency in scoring', () => {
    const base = scoreRevenuePlanCandidate(buildCandidate());
    const withMoney = scoreRevenuePlanCandidate(
      buildCandidate({ monetaryAmount: 999999, currency: 'EUR' }),
    );
    expect(withMoney).toEqual(base);
  });

  it('lowers priority as effort rises (same impact inputs)', () => {
    const lowEffort = scoreRevenuePlanCandidate(buildCandidate({ estimatedEffort: 0 }));
    const highEffort = scoreRevenuePlanCandidate(buildCandidate({ estimatedEffort: 100 }));
    expect(lowEffort.revenueImpactScore).toBe(highEffort.revenueImpactScore);
    // impact 31: priorityScore 52 (MEDIUM) vs 22 (LOW)
    expect(lowEffort.priority).toBe('MEDIUM');
    expect(highEffort.priority).toBe('LOW');
  });

  it('applies valueBand thresholds at 34 and 67', () => {
    // MEDIUM: value 100, conv 60, risk 100, conf 100 -> blend 100, pwrs 60, impact 60
    expect(
      scoreRevenuePlanCandidate(
        buildCandidate({
          expectedValue: 100,
          conversionProbability: 60,
          retentionRisk: 100,
          confidence: 100,
        }),
      ).valueBand,
    ).toBe('MEDIUM');
    // HIGH: all max -> impact 100
    expect(
      scoreRevenuePlanCandidate(
        buildCandidate({
          expectedValue: 100,
          conversionProbability: 100,
          retentionRisk: 100,
          confidence: 100,
        }),
      ).valueBand,
    ).toBe('HIGH');
    // LOW: worked example -> impact 31
    expect(scoreRevenuePlanCandidate(buildCandidate()).valueBand).toBe('LOW');
  });

  it('applies effortBand thresholds at 34 and 67', () => {
    expect(scoreRevenuePlanCandidate(buildCandidate({ estimatedEffort: 33 })).effortBand).toBe(
      'LOW',
    );
    expect(scoreRevenuePlanCandidate(buildCandidate({ estimatedEffort: 34 })).effortBand).toBe(
      'MEDIUM',
    );
    expect(scoreRevenuePlanCandidate(buildCandidate({ estimatedEffort: 66 })).effortBand).toBe(
      'MEDIUM',
    );
    expect(scoreRevenuePlanCandidate(buildCandidate({ estimatedEffort: 67 })).effortBand).toBe(
      'HIGH',
    );
  });

  it('applies priority thresholds (HIGH >= 70, MEDIUM >= 40, else LOW)', () => {
    expect(
      scoreRevenuePlanCandidate(
        buildCandidate({
          expectedValue: 100,
          conversionProbability: 100,
          retentionRisk: 100,
          confidence: 100,
          estimatedEffort: 0,
        }),
      ).priority,
    ).toBe('HIGH');
    expect(
      scoreRevenuePlanCandidate(
        buildCandidate({
          expectedValue: 0,
          conversionProbability: 0,
          retentionRisk: 0,
          confidence: 0,
          estimatedEffort: 100,
        }),
      ).priority,
    ).toBe('LOW');
    expect(scoreRevenuePlanCandidate(buildCandidate()).priority).toBe('MEDIUM');
  });

  it('does not use planType, target, domains, or source refs in scoring', () => {
    const base = scoreRevenuePlanCandidate(buildCandidate());
    const altered = scoreRevenuePlanCandidate(
      buildCandidate({
        planType: 'PRICING_PACKAGING',
        target: { kind: 'SUBSCRIPTION', key: 'sub:zzz' },
        executionDomains: [ExecutionDomain.Automation, ExecutionDomain.Reporting],
        sourceRefs: [{ referenceId: 'x', referenceType: 'Y' }],
      }),
    );
    expect(altered).toEqual(base);
  });
});
