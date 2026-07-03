import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { scoreGrowthPlan } from '../../processing/score-growth-plan';
import type { GrowthPlanCandidate } from '../../processing/growth-plan-candidate';

function buildCandidate(overrides: Partial<GrowthPlanCandidate> = {}): GrowthPlanCandidate {
  return {
    planId: 'plan-1',
    planType: 'PAID_ACQUISITION',
    target: { kind: 'OPPORTUNITY', key: 'opp:signal-1' },
    executionDomains: [ExecutionDomain.GoogleAds],
    expectedImpact: 0,
    confidence: 0,
    estimatedEffort: 0,
    sourceRefs: [{ opportunityId: 'opp-1' }],
    ...overrides,
  };
}

describe('scoreGrowthPlan', () => {
  it('returns the minimum-impact boundary for zero inputs', () => {
    const score = scoreGrowthPlan(
      buildCandidate({ expectedImpact: 0, confidence: 0, estimatedEffort: 0 }),
    );
    // impact 0, effort 0 -> priorityScore round(0 + 30) = 30 -> LOW; effortBand LOW
    expect(score).toEqual({
      impactScore: 0,
      effortScore: 0,
      effortBand: 'LOW',
      confidenceScore: 0,
      priority: 'LOW',
    });
  });

  it('returns the maximum boundary for saturated inputs', () => {
    const score = scoreGrowthPlan(
      buildCandidate({ expectedImpact: 100, confidence: 100, estimatedEffort: 100 }),
    );
    // impact 100, effort 100 -> priorityScore round(70 + 0) = 70 -> HIGH; effortBand HIGH
    expect(score).toEqual({
      impactScore: 100,
      effortScore: 100,
      effortBand: 'HIGH',
      confidenceScore: 100,
      priority: 'HIGH',
    });
  });

  it('computes the mid case deterministically', () => {
    const score = scoreGrowthPlan(
      buildCandidate({ expectedImpact: 50, confidence: 50, estimatedEffort: 50 }),
    );
    // impact round(30+20)=50; priorityScore round(35 + 0.3*50=15)=50 -> MEDIUM; effortBand MEDIUM
    expect(score).toEqual({
      impactScore: 50,
      effortScore: 50,
      effortBand: 'MEDIUM',
      confidenceScore: 50,
      priority: 'MEDIUM',
    });
  });

  it('weights the impact formula 0.60/0.40 (expectedImpact/confidence)', () => {
    expect(
      scoreGrowthPlan(buildCandidate({ expectedImpact: 100, confidence: 0 })).impactScore,
    ).toBe(60);
    expect(
      scoreGrowthPlan(buildCandidate({ expectedImpact: 0, confidence: 100 })).impactScore,
    ).toBe(40);
  });

  it('maps effortBand thresholds LOW (<34) / MEDIUM ([34,67)) / HIGH (>=67)', () => {
    expect(scoreGrowthPlan(buildCandidate({ estimatedEffort: 33 })).effortBand).toBe('LOW');
    expect(scoreGrowthPlan(buildCandidate({ estimatedEffort: 34 })).effortBand).toBe('MEDIUM');
    expect(scoreGrowthPlan(buildCandidate({ estimatedEffort: 66 })).effortBand).toBe('MEDIUM');
    expect(scoreGrowthPlan(buildCandidate({ estimatedEffort: 67 })).effortBand).toBe('HIGH');
  });

  it('maps priority thresholds HIGH (>=70) / MEDIUM ([40,70)) / LOW (<40)', () => {
    // impact 100, effort 0 -> priorityScore round(70 + 30) = 100 -> HIGH
    expect(
      scoreGrowthPlan(buildCandidate({ expectedImpact: 100, confidence: 100, estimatedEffort: 0 }))
        .priority,
    ).toBe('HIGH');
    // impact 50, effort 50 -> priorityScore 50 -> MEDIUM
    expect(
      scoreGrowthPlan(buildCandidate({ expectedImpact: 50, confidence: 50, estimatedEffort: 50 }))
        .priority,
    ).toBe('MEDIUM');
    // impact 50, effort 100 -> priorityScore round(35 + 0) = 35 -> LOW
    expect(
      scoreGrowthPlan(buildCandidate({ expectedImpact: 50, confidence: 50, estimatedEffort: 100 }))
        .priority,
    ).toBe('LOW');
  });

  it('penalizes higher effort with lower priority for the same impact', () => {
    const lowEffort = scoreGrowthPlan(
      buildCandidate({ expectedImpact: 50, confidence: 50, estimatedEffort: 0 }),
    );
    const highEffort = scoreGrowthPlan(
      buildCandidate({ expectedImpact: 50, confidence: 50, estimatedEffort: 100 }),
    );
    expect(lowEffort.impactScore).toBe(highEffort.impactScore);
    expect(lowEffort.priority).toBe('MEDIUM');
    expect(highEffort.priority).toBe('LOW');
  });

  it('never returns a score outside [0, 100]', () => {
    const score = scoreGrowthPlan(
      buildCandidate({ expectedImpact: 100, confidence: 100, estimatedEffort: 100 }),
    );
    for (const value of [score.impactScore, score.effortScore, score.confidenceScore]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic for the same input', () => {
    const candidate = buildCandidate({ expectedImpact: 63, confidence: 41, estimatedEffort: 55 });
    expect(scoreGrowthPlan(candidate)).toEqual(scoreGrowthPlan(candidate));
  });
});
