import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { deduplicateGrowthPlans } from '../../processing/deduplicate-growth-plans';
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

describe('deduplicateGrowthPlans', () => {
  it('keeps structurally distinct candidates and reports no duplicates', () => {
    const result = deduplicateGrowthPlans([
      buildCandidate({ planId: 'plan-1' }),
      buildCandidate({ planId: 'plan-2', target: { kind: 'OPPORTUNITY', key: 'opp:other' } }),
    ]);
    expect(result.acceptedCandidates).toHaveLength(2);
    expect(result.duplicateReferences).toEqual([]);
  });

  it('flags a later candidate with the same structural key as a duplicate of the first', () => {
    const result = deduplicateGrowthPlans([
      buildCandidate({ planId: 'plan-1', sourceRefs: [{ opportunityId: 'o1' }] }),
      buildCandidate({ planId: 'plan-2', sourceRefs: [{ opportunityId: 'o2' }] }),
    ]);
    expect(result.acceptedCandidates).toHaveLength(1);
    expect(result.duplicateReferences).toEqual([{ planId: 'plan-2', duplicateOfPlanId: 'plan-1' }]);
  });

  it('treats execution-domain order as insignificant in the structural key', () => {
    const result = deduplicateGrowthPlans([
      buildCandidate({
        planId: 'plan-1',
        executionDomains: [ExecutionDomain.GoogleAds, ExecutionDomain.MetaAds],
      }),
      buildCandidate({
        planId: 'plan-2',
        executionDomains: [ExecutionDomain.MetaAds, ExecutionDomain.GoogleAds],
      }),
    ]);
    expect(result.duplicateReferences).toEqual([{ planId: 'plan-2', duplicateOfPlanId: 'plan-1' }]);
  });

  it('does not merge candidates differing by planType or target', () => {
    const result = deduplicateGrowthPlans([
      buildCandidate({ planId: 'plan-1', planType: 'PAID_ACQUISITION' }),
      buildCandidate({ planId: 'plan-2', planType: 'CONVERSION_OPTIMIZATION' }),
    ]);
    expect(result.acceptedCandidates).toHaveLength(2);
    expect(result.duplicateReferences).toEqual([]);
  });

  it('merges duplicate source refs into the accepted original for provenance', () => {
    const result = deduplicateGrowthPlans([
      buildCandidate({ planId: 'plan-1', sourceRefs: [{ opportunityId: 'o1' }] }),
      buildCandidate({ planId: 'plan-2', sourceRefs: [{ opportunityId: 'o2' }] }),
    ]);
    expect(result.acceptedCandidates[0]?.sourceRefs).toEqual([
      { opportunityId: 'o1' },
      { opportunityId: 'o2' },
    ]);
  });

  it('reports each duplicate exactly once and points every duplicate at the first-seen original', () => {
    const result = deduplicateGrowthPlans([
      buildCandidate({ planId: 'plan-1' }),
      buildCandidate({ planId: 'plan-2' }),
      buildCandidate({ planId: 'plan-3' }),
    ]);
    const ids = result.duplicateReferences.map((d) => d.planId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.duplicateReferences).toEqual([
      { planId: 'plan-2', duplicateOfPlanId: 'plan-1' },
      { planId: 'plan-3', duplicateOfPlanId: 'plan-1' },
    ]);
  });

  it('is deterministic for the same input', () => {
    const candidates = [buildCandidate({ planId: 'plan-1' }), buildCandidate({ planId: 'plan-2' })];
    expect(deduplicateGrowthPlans(candidates)).toEqual(deduplicateGrowthPlans(candidates));
  });
});
