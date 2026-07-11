import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { scoreOperationsPlanCandidate } from '../../processing/score-operations-plan-candidate';
import type { OperationsPlanCandidate } from '../../processing/operations-plan-candidate';

function buildCandidate(overrides: Partial<OperationsPlanCandidate> = {}): OperationsPlanCandidate {
  return {
    operationsPlanId: 'ops-plan-1',
    planType: 'PROJECT_PLAN',
    target: { kind: 'PROJECT', key: 'project:acme' },
    executionDomains: [ExecutionDomain.Reporting],
    operationalUrgency: 80,
    deliveryRisk: 50,
    estimatedEffort: 40,
    confidence: 70,
    sourceRefs: [{ referenceId: 'ref-1', referenceType: 'AUTHORITY_PLAN' }],
    ...overrides,
  };
}

describe('scoreOperationsPlanCandidate', () => {
  it('computes the known worked example (urgency 80, risk 50, effort 40, confidence 70)', () => {
    // blend = round(0.5*50 + 0.5*80) = 65
    // impact = round(0.6*65 + 0.4*70) = 67
    // priorityScore = round(0.7*67 + 0.3*(100-40)) = 65 -> MEDIUM
    const score = scoreOperationsPlanCandidate(buildCandidate());
    expect(score).toEqual({
      operationalImpactScore: 67,
      effortScore: 40,
      effortBand: 'MEDIUM',
      confidenceScore: 70,
      priority: 'MEDIUM',
    });
  });

  it('lowers priority as effort rises (same impact inputs)', () => {
    const lowEffort = scoreOperationsPlanCandidate(buildCandidate({ estimatedEffort: 0 }));
    const highEffort = scoreOperationsPlanCandidate(buildCandidate({ estimatedEffort: 100 }));
    // impact 67 both; priorityScore 77 (HIGH) vs 47 (MEDIUM)
    expect(lowEffort.priority).toBe('HIGH');
    expect(highEffort.priority).toBe('MEDIUM');
    expect(lowEffort.operationalImpactScore).toBe(highEffort.operationalImpactScore);
  });

  it('applies effort band thresholds at 34 and 67', () => {
    expect(scoreOperationsPlanCandidate(buildCandidate({ estimatedEffort: 33 })).effortBand).toBe(
      'LOW',
    );
    expect(scoreOperationsPlanCandidate(buildCandidate({ estimatedEffort: 34 })).effortBand).toBe(
      'MEDIUM',
    );
    expect(scoreOperationsPlanCandidate(buildCandidate({ estimatedEffort: 66 })).effortBand).toBe(
      'MEDIUM',
    );
    expect(scoreOperationsPlanCandidate(buildCandidate({ estimatedEffort: 67 })).effortBand).toBe(
      'HIGH',
    );
  });

  it('applies priority thresholds (HIGH >= 70, MEDIUM >= 40, else LOW)', () => {
    // All-max, no effort -> priorityScore 100 -> HIGH
    expect(
      scoreOperationsPlanCandidate(
        buildCandidate({
          operationalUrgency: 100,
          deliveryRisk: 100,
          confidence: 100,
          estimatedEffort: 0,
        }),
      ).priority,
    ).toBe('HIGH');
    // All-zero, max effort -> priorityScore 0 -> LOW
    expect(
      scoreOperationsPlanCandidate(
        buildCandidate({
          operationalUrgency: 0,
          deliveryRisk: 0,
          confidence: 0,
          estimatedEffort: 100,
        }),
      ).priority,
    ).toBe('LOW');
    // Worked example -> MEDIUM
    expect(scoreOperationsPlanCandidate(buildCandidate()).priority).toBe('MEDIUM');
  });

  it('clamps out-of-range inputs into [0,100]', () => {
    const score = scoreOperationsPlanCandidate(
      buildCandidate({
        operationalUrgency: 150,
        deliveryRisk: 150,
        confidence: 150,
        estimatedEffort: -10,
      }),
    );
    expect(score.effortScore).toBe(0);
    expect(score.confidenceScore).toBe(100);
    expect(score.operationalImpactScore).toBe(100);
    expect(score.priority).toBe('HIGH');
  });

  it('treats non-finite inputs as 0', () => {
    const score = scoreOperationsPlanCandidate(
      buildCandidate({ confidence: Number.NaN, deliveryRisk: Number.POSITIVE_INFINITY }),
    );
    // risk -> 0, urgency 80 -> blend round(0.5*0 + 0.5*80)=40; confidence -> 0
    // impact = round(0.6*40 + 0.4*0) = 24
    expect(score.confidenceScore).toBe(0);
    expect(score.operationalImpactScore).toBe(24);
  });

  it('does not use source refs, target, domains, or planType in scoring (structural independence)', () => {
    const base = scoreOperationsPlanCandidate(buildCandidate());
    const altered = scoreOperationsPlanCandidate(
      buildCandidate({
        planType: 'DELIVERY_TRACKING',
        target: { kind: 'ASSIGNEE', key: 'assignee:zzz' },
        executionDomains: [ExecutionDomain.Automation, ExecutionDomain.CRM],
        sourceRefs: [
          { referenceId: 'x', referenceType: 'Y' },
          { referenceId: 'p', referenceType: 'Q' },
        ],
      }),
    );
    expect(altered).toEqual(base);
  });
});
