import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import type {
  GrowthEffortBand,
  GrowthInput,
  GrowthPlanningInputItem,
  GrowthPlanPriority,
  GrowthPlanSourceRef,
  GrowthPlanTarget,
  GrowthPlanTargetKind,
  GrowthPlanType,
  MarketOpportunityReference,
} from '../index';

function buildOpportunityReference(
  overrides: Partial<MarketOpportunityReference> = {},
): MarketOpportunityReference {
  const target: GrowthPlanTarget = { kind: 'OPPORTUNITY', key: 'opp:signal-1' };
  return {
    opportunityId: 'signal-1',
    opportunityType: 'VISIBILITY',
    target,
    executionDomains: [ExecutionDomain.GoogleAds],
    impactScore: 70,
    confidenceScore: 65,
    ...overrides,
  };
}

function buildPlanningItem(
  overrides: Partial<GrowthPlanningInputItem> = {},
): GrowthPlanningInputItem {
  return {
    id: 'plan-1',
    planType: 'PAID_ACQUISITION',
    opportunity: buildOpportunityReference(),
    executionDomains: [ExecutionDomain.GoogleAds],
    expectedImpact: 80,
    confidence: 70,
    estimatedEffort: 40,
    ...overrides,
  };
}

describe('@age/growth-contracts', () => {
  it('constructs a well-formed GrowthPlanningInputItem with explicit scoring inputs', () => {
    const item = buildPlanningItem();
    expect(item.planType).toBe('PAID_ACQUISITION');
    expect(item.expectedImpact).toBe(80);
    expect(item.confidence).toBe(70);
    expect(item.estimatedEffort).toBe(40);
  });

  it('carries a caller-provided planType (not derived)', () => {
    const cro = buildPlanningItem({ planType: 'CONVERSION_OPTIMIZATION' });
    expect(cro.planType).toBe('CONVERSION_OPTIMIZATION');
  });

  it('references a Market Discovery opportunity via a neutral value shape', () => {
    const ref = buildOpportunityReference({
      opportunityId: 'signal-42',
      opportunityType: 'DEMAND_CAPTURE',
    });
    expect(ref.opportunityId).toBe('signal-42');
    expect(ref.opportunityType).toBe('DEMAND_CAPTURE');
    expect(ref.target).toEqual({ kind: 'OPPORTUNITY', key: 'opp:signal-1' });
  });

  it('allows a GrowthPlanTarget that does not preserve the original Market Discovery target kind', () => {
    const funnelTarget: GrowthPlanTarget = { kind: 'FUNNEL_STAGE', key: 'funnel:checkout' };
    const ref = buildOpportunityReference({ target: funnelTarget });
    expect(ref.target.kind).toBe('FUNNEL_STAGE');
  });

  it('carries ExecutionDomain values as opaque structural tags', () => {
    const item = buildPlanningItem({
      executionDomains: [ExecutionDomain.GoogleAds, ExecutionDomain.MetaAds, ExecutionDomain.CRO],
    });
    expect(item.executionDomains).toHaveLength(3);
    expect(item.executionDomains).toContain(ExecutionDomain.CRO);
  });

  it('constructs a GrowthInput batching multiple planning items', () => {
    const input: GrowthInput = {
      clientId: 'client-1',
      organizationId: 'org-1',
      planningItems: [
        buildPlanningItem({ id: 'plan-1' }),
        buildPlanningItem({ id: 'plan-2', planType: 'LANDING_EXPERIENCE' }),
      ],
      generatedAt: '2026-07-10T00:00:00.000Z',
    };
    expect(input.planningItems).toHaveLength(2);
    expect(input.planningItems.map((p) => p.id)).toEqual(['plan-1', 'plan-2']);
    expect(input.generatedAt).toBe('2026-07-10T00:00:00.000Z');
  });

  it('constructs a GrowthPlanSourceRef', () => {
    const ref: GrowthPlanSourceRef = { opportunityId: 'signal-1' };
    expect(ref.opportunityId).toBe('signal-1');
  });

  it('accepts every declared GrowthPlanType', () => {
    const types: readonly GrowthPlanType[] = [
      'PAID_ACQUISITION',
      'CONVERSION_OPTIMIZATION',
      'LANDING_EXPERIENCE',
      'CONTENT_DISTRIBUTION',
    ];
    expect(types).toHaveLength(4);
  });

  it('accepts every declared GrowthPlanTargetKind', () => {
    const kinds: readonly GrowthPlanTargetKind[] = [
      'OPPORTUNITY',
      'FUNNEL_STAGE',
      'AUDIENCE',
      'PAGE',
    ];
    expect(kinds).toHaveLength(4);
  });

  it('accepts every declared GrowthPlanPriority and GrowthEffortBand', () => {
    const priorities: readonly GrowthPlanPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
    const bands: readonly GrowthEffortBand[] = ['LOW', 'MEDIUM', 'HIGH'];
    expect(priorities).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(bands).toEqual(['LOW', 'MEDIUM', 'HIGH']);
  });
});
