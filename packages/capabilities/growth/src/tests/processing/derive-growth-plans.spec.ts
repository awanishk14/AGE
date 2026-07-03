import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import type { GrowthInput, GrowthPlanningInputItem } from '@age/growth-contracts';
import { deriveGrowthPlans } from '../../processing/derive-growth-plans';

function buildPlanningItem(
  overrides: Partial<GrowthPlanningInputItem> = {},
): GrowthPlanningInputItem {
  return {
    id: 'plan-1',
    planType: 'PAID_ACQUISITION',
    opportunity: {
      opportunityId: 'opp-1',
      opportunityType: 'VISIBILITY',
      target: { kind: 'OPPORTUNITY', key: 'opp:signal-1' },
      executionDomains: [ExecutionDomain.GoogleAds],
      impactScore: 70,
      confidenceScore: 65,
    },
    executionDomains: [ExecutionDomain.GoogleAds],
    expectedImpact: 80,
    confidence: 70,
    estimatedEffort: 40,
    ...overrides,
  };
}

function buildInput(items: readonly GrowthPlanningInputItem[]): GrowthInput {
  return {
    clientId: 'client-1',
    organizationId: 'org-1',
    planningItems: items,
    generatedAt: '2026-07-10T00:00:00.000Z',
  };
}

describe('deriveGrowthPlans', () => {
  it('produces exactly one candidate per planning item', () => {
    const candidates = deriveGrowthPlans(
      buildInput([
        buildPlanningItem({ id: 'plan-1' }),
        buildPlanningItem({ id: 'plan-2' }),
        buildPlanningItem({ id: 'plan-3' }),
      ]),
    );
    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.planId)).toEqual(['plan-1', 'plan-2', 'plan-3']);
  });

  it('returns an empty list for empty input', () => {
    expect(deriveGrowthPlans(buildInput([]))).toEqual([]);
  });

  it('carries the caller-provided planType', () => {
    const [candidate] = deriveGrowthPlans(
      buildInput([buildPlanningItem({ planType: 'CONVERSION_OPTIMIZATION' })]),
    );
    expect(candidate?.planType).toBe('CONVERSION_OPTIMIZATION');
  });

  it('uses the opportunity target as the candidate target', () => {
    const [candidate] = deriveGrowthPlans(
      buildInput([
        buildPlanningItem({
          opportunity: {
            opportunityId: 'opp-9',
            opportunityType: 'CONVERSION',
            target: { kind: 'FUNNEL_STAGE', key: 'funnel:checkout' },
            executionDomains: [ExecutionDomain.CRO],
            impactScore: 50,
            confidenceScore: 40,
          },
        }),
      ]),
    );
    expect(candidate?.target).toEqual({ kind: 'FUNNEL_STAGE', key: 'funnel:checkout' });
  });

  it('creates a source ref from the opportunity id', () => {
    const [candidate] = deriveGrowthPlans(
      buildInput([
        buildPlanningItem({
          id: 'plan-7',
          opportunity: {
            opportunityId: 'opp-77',
            opportunityType: 'VISIBILITY',
            target: { kind: 'OPPORTUNITY', key: 'opp:77' },
            executionDomains: [ExecutionDomain.SEO],
            impactScore: 10,
            confidenceScore: 10,
          },
        }),
      ]),
    );
    expect(candidate?.planId).toBe('plan-7');
    expect(candidate?.sourceRefs).toEqual([{ opportunityId: 'opp-77' }]);
  });

  it('preserves executionDomains and scoring inputs', () => {
    const [candidate] = deriveGrowthPlans(
      buildInput([
        buildPlanningItem({
          executionDomains: [ExecutionDomain.GoogleAds, ExecutionDomain.MetaAds],
          expectedImpact: 61,
          confidence: 42,
          estimatedEffort: 55,
        }),
      ]),
    );
    expect(candidate?.executionDomains).toEqual([
      ExecutionDomain.GoogleAds,
      ExecutionDomain.MetaAds,
    ]);
    expect(candidate?.expectedImpact).toBe(61);
    expect(candidate?.confidence).toBe(42);
    expect(candidate?.estimatedEffort).toBe(55);
  });

  it('is deterministic for the same input', () => {
    const input = buildInput([
      buildPlanningItem({ id: 'plan-1' }),
      buildPlanningItem({ id: 'plan-2' }),
    ]);
    expect(deriveGrowthPlans(input)).toEqual(deriveGrowthPlans(input));
  });
});
