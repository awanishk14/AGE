import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { validateGrowthPlan } from '../../processing/validate-growth-plan';
import type { GrowthPlanCandidate } from '../../processing/growth-plan-candidate';

function buildCandidate(overrides: Partial<GrowthPlanCandidate> = {}): GrowthPlanCandidate {
  return {
    planId: 'plan-1',
    planType: 'PAID_ACQUISITION',
    target: { kind: 'OPPORTUNITY', key: 'opp:signal-1' },
    executionDomains: [ExecutionDomain.GoogleAds],
    expectedImpact: 80,
    confidence: 70,
    estimatedEffort: 40,
    sourceRefs: [{ opportunityId: 'opp-1' }],
    ...overrides,
  };
}

describe('validateGrowthPlan', () => {
  it('returns null for a well-formed candidate', () => {
    expect(validateGrowthPlan(buildCandidate())).toBeNull();
  });

  it('rejects with MISSING_ID when planId is blank', () => {
    expect(validateGrowthPlan(buildCandidate({ planId: '  ' }))?.reasonCode).toBe('MISSING_ID');
  });

  it('rejects with EMPTY_PLAN_TARGET when target key is blank', () => {
    const result = validateGrowthPlan(buildCandidate({ target: { kind: 'OPPORTUNITY', key: '' } }));
    expect(result?.reasonCode).toBe('EMPTY_PLAN_TARGET');
  });

  it('rejects with NO_EXECUTION_DOMAIN when executionDomains is empty', () => {
    expect(validateGrowthPlan(buildCandidate({ executionDomains: [] }))?.reasonCode).toBe(
      'NO_EXECUTION_DOMAIN',
    );
  });

  it('rejects with NO_SOURCE_REF when sourceRefs is empty', () => {
    expect(validateGrowthPlan(buildCandidate({ sourceRefs: [] }))?.reasonCode).toBe(
      'NO_SOURCE_REF',
    );
  });

  it('rejects with INVALID_IMPACT when expectedImpact is out of range', () => {
    expect(validateGrowthPlan(buildCandidate({ expectedImpact: -1 }))?.reasonCode).toBe(
      'INVALID_IMPACT',
    );
    expect(validateGrowthPlan(buildCandidate({ expectedImpact: 101 }))?.reasonCode).toBe(
      'INVALID_IMPACT',
    );
  });

  it('rejects with INVALID_EFFORT when estimatedEffort is out of range', () => {
    expect(validateGrowthPlan(buildCandidate({ estimatedEffort: 101 }))?.reasonCode).toBe(
      'INVALID_EFFORT',
    );
  });

  it('rejects with INVALID_CONFIDENCE when confidence is out of range', () => {
    expect(validateGrowthPlan(buildCandidate({ confidence: -5 }))?.reasonCode).toBe(
      'INVALID_CONFIDENCE',
    );
  });

  it('accepts boundary score values 0 and 100', () => {
    expect(
      validateGrowthPlan(buildCandidate({ expectedImpact: 0, confidence: 0, estimatedEffort: 0 })),
    ).toBeNull();
    expect(
      validateGrowthPlan(
        buildCandidate({ expectedImpact: 100, confidence: 100, estimatedEffort: 100 }),
      ),
    ).toBeNull();
  });

  it('returns exactly one reason using the first violated rule in fixed order', () => {
    const result = validateGrowthPlan(
      buildCandidate({
        planId: '',
        target: { kind: 'OPPORTUNITY', key: '' },
        executionDomains: [],
      }),
    );
    expect(result?.reasonCode).toBe('MISSING_ID');
  });

  it('attributes the reason to the correct planId', () => {
    const result = validateGrowthPlan(buildCandidate({ planId: 'plan-9', sourceRefs: [] }));
    expect(result?.planId).toBe('plan-9');
  });
});
