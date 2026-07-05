import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { scoreAuthorityPlanCandidate } from '../../processing/score-authority-plan-candidate';
import type { AuthorityPlanCandidate } from '../../processing/authority-plan-candidate';

function buildCandidate(overrides: Partial<AuthorityPlanCandidate> = {}): AuthorityPlanCandidate {
  return {
    authorityPlanId: 'plan-1',
    planType: 'CONTENT_STRATEGY',
    target: { kind: 'OPPORTUNITY', key: 'opp:signal-1' },
    executionDomains: [ExecutionDomain.Content],
    expectedImpact: 50,
    confidence: 50,
    estimatedEffort: 50,
    sourceRefs: [{ referenceId: 'ref-1', referenceType: 'OPPORTUNITY' }],
    ...overrides,
  };
}

describe('scoreAuthorityPlanCandidate', () => {
  it('scores the all-zero case', () => {
    const score = scoreAuthorityPlanCandidate(
      buildCandidate({ expectedImpact: 0, confidence: 0, estimatedEffort: 0 }),
    );
    expect(score.impactScore).toBe(0);
    expect(score.effortScore).toBe(0);
    expect(score.confidenceScore).toBe(0);
    // priorityScore = round(0.7*0 + 0.3*100) = 30 -> LOW
    expect(score.priority).toBe('LOW');
    expect(score.effortBand).toBe('LOW');
  });

  it('scores the midpoint case', () => {
    const score = scoreAuthorityPlanCandidate(
      buildCandidate({ expectedImpact: 50, confidence: 50, estimatedEffort: 50 }),
    );
    // impact = round(0.6*50 + 0.4*50) = 50
    expect(score.impactScore).toBe(50);
    expect(score.effortScore).toBe(50);
    expect(score.confidenceScore).toBe(50);
    // priorityScore = round(0.7*50 + 0.3*50) = 50 -> MEDIUM
    expect(score.priority).toBe('MEDIUM');
    expect(score.effortBand).toBe('MEDIUM');
  });

  it('scores the all-100 case', () => {
    const score = scoreAuthorityPlanCandidate(
      buildCandidate({ expectedImpact: 100, confidence: 100, estimatedEffort: 100 }),
    );
    expect(score.impactScore).toBe(100);
    expect(score.effortScore).toBe(100);
    expect(score.confidenceScore).toBe(100);
    // priorityScore = round(0.7*100 + 0.3*0) = 70 -> HIGH
    expect(score.priority).toBe('HIGH');
    expect(score.effortBand).toBe('HIGH');
  });

  it('uses Growth impact weights 0.60 impact / 0.40 confidence', () => {
    expect(
      scoreAuthorityPlanCandidate(buildCandidate({ expectedImpact: 100, confidence: 0 }))
        .impactScore,
    ).toBe(60);
    expect(
      scoreAuthorityPlanCandidate(buildCandidate({ expectedImpact: 0, confidence: 100 }))
        .impactScore,
    ).toBe(40);
  });

  it('applies effort-band thresholds (>=67 HIGH, >=34 MEDIUM, else LOW)', () => {
    expect(scoreAuthorityPlanCandidate(buildCandidate({ estimatedEffort: 67 })).effortBand).toBe(
      'HIGH',
    );
    expect(scoreAuthorityPlanCandidate(buildCandidate({ estimatedEffort: 66 })).effortBand).toBe(
      'MEDIUM',
    );
    expect(scoreAuthorityPlanCandidate(buildCandidate({ estimatedEffort: 34 })).effortBand).toBe(
      'MEDIUM',
    );
    expect(scoreAuthorityPlanCandidate(buildCandidate({ estimatedEffort: 33 })).effortBand).toBe(
      'LOW',
    );
  });

  it('applies priority thresholds (>=70 HIGH, >=40 MEDIUM, else LOW)', () => {
    // impact 100, effort 0 -> priorityScore = round(70 + 30) = 100 -> HIGH
    expect(
      scoreAuthorityPlanCandidate(
        buildCandidate({ expectedImpact: 100, confidence: 100, estimatedEffort: 0 }),
      ).priority,
    ).toBe('HIGH');
    // impact 0, effort 0 -> priorityScore = 30 -> LOW
    expect(
      scoreAuthorityPlanCandidate(
        buildCandidate({ expectedImpact: 0, confidence: 0, estimatedEffort: 0 }),
      ).priority,
    ).toBe('LOW');
    // impact 50, effort 50 -> priorityScore = 50 -> MEDIUM
    expect(
      scoreAuthorityPlanCandidate(
        buildCandidate({ expectedImpact: 50, confidence: 50, estimatedEffort: 50 }),
      ).priority,
    ).toBe('MEDIUM');
  });

  it('higher effort lowers priority for a fixed impact', () => {
    const lowEffort = scoreAuthorityPlanCandidate(
      buildCandidate({ expectedImpact: 60, confidence: 60, estimatedEffort: 0 }),
    );
    const highEffort = scoreAuthorityPlanCandidate(
      buildCandidate({ expectedImpact: 60, confidence: 60, estimatedEffort: 100 }),
    );
    expect(lowEffort.impactScore).toBe(highEffort.impactScore);
    // priorityScore: low-effort round(0.7*60 + 30) = 72 ; high-effort round(0.7*60) = 42
    expect(lowEffort.priority).toBe('HIGH');
    expect(highEffort.priority).toBe('MEDIUM');
  });

  it('clamps all numeric outputs to [0,100]', () => {
    const score = scoreAuthorityPlanCandidate(
      buildCandidate({ expectedImpact: 150, confidence: 150, estimatedEffort: 150 }),
    );
    expect(score.impactScore).toBe(100);
    expect(score.effortScore).toBe(100);
    expect(score.confidenceScore).toBe(100);
  });

  it('is deterministic across repeated calls', () => {
    const candidate = buildCandidate({ expectedImpact: 73, confidence: 41, estimatedEffort: 58 });
    expect(scoreAuthorityPlanCandidate(candidate)).toEqual(scoreAuthorityPlanCandidate(candidate));
  });
});
