import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import type {
  RevenueEffortBand,
  RevenueInput,
  RevenuePlanningInputItem,
  RevenuePlanPriority,
  RevenuePlanReference,
  RevenuePlanSourceRef,
  RevenuePlanTarget,
  RevenuePlanTargetKind,
  RevenuePlanType,
  RevenuePlanValueBand,
} from '../index';

function buildReference(overrides: Partial<RevenuePlanReference> = {}): RevenuePlanReference {
  const target: RevenuePlanTarget = { kind: 'ACCOUNT', key: 'account:acme' };
  return {
    referenceId: 'ops-1',
    referenceType: 'OPERATIONS_PLAN',
    target,
    executionDomains: [ExecutionDomain.CRM],
    expectedValueScore: 70,
    conversionProbabilityScore: 55,
    retentionRiskScore: 40,
    confidenceScore: 65,
    ...overrides,
  };
}

function buildPlanningItem(
  overrides: Partial<RevenuePlanningInputItem> = {},
): RevenuePlanningInputItem {
  return {
    id: 'rev-plan-1',
    planType: 'UPSELL',
    reference: buildReference(),
    executionDomains: [ExecutionDomain.CRM],
    expectedValue: 80,
    conversionProbability: 50,
    retentionRisk: 40,
    estimatedEffort: 40,
    confidence: 70,
    ...overrides,
  };
}

describe('@age/revenue-contracts', () => {
  it('constructs a well-formed RevenuePlanningInputItem carrying all five scoring inputs', () => {
    const item = buildPlanningItem();
    expect(item.planType).toBe('UPSELL');
    expect(item.expectedValue).toBe(80);
    expect(item.conversionProbability).toBe(50);
    expect(item.retentionRisk).toBe(40);
    expect(item.estimatedEffort).toBe(40);
    expect(item.confidence).toBe(70);
  });

  it('carries a caller-provided planType (not derived)', () => {
    const retention = buildPlanningItem({ planType: 'RETENTION' });
    expect(retention.planType).toBe('RETENTION');
  });

  it('constructs a RevenuePlanTarget of any declared kind', () => {
    const contractTarget: RevenuePlanTarget = { kind: 'CONTRACT', key: 'contract:c-42' };
    expect(contractTarget.kind).toBe('CONTRACT');
    expect(contractTarget.key).toBe('contract:c-42');
  });

  it('constructs a RevenuePlanSourceRef preserving referenceId and referenceType', () => {
    const ref: RevenuePlanSourceRef = { referenceId: 'ops-1', referenceType: 'OPERATIONS_PLAN' };
    expect(ref.referenceId).toBe('ops-1');
    expect(ref.referenceType).toBe('OPERATIONS_PLAN');
  });

  it('constructs a RevenuePlanReference and preserves referenceId/referenceType (incl. OPERATIONS_PLAN)', () => {
    const ref = buildReference({ referenceId: 'ops-9', referenceType: 'OPERATIONS_PLAN' });
    expect(ref.referenceId).toBe('ops-9');
    expect(ref.referenceType).toBe('OPERATIONS_PLAN');
    expect(ref.target).toEqual({ kind: 'ACCOUNT', key: 'account:acme' });
    expect(ref.expectedValueScore).toBe(70);
    expect(ref.conversionProbabilityScore).toBe(55);
    expect(ref.retentionRiskScore).toBe(40);
    expect(ref.confidenceScore).toBe(65);
  });

  it('references upstream concepts through neutral referenceType strings', () => {
    for (const referenceType of [
      'OPPORTUNITY',
      'GROWTH_PLAN',
      'AUTHORITY_PLAN',
      'OPERATIONS_PLAN',
      'SIE_DECISION',
    ]) {
      const ref = buildReference({ referenceType });
      expect(ref.referenceType).toBe(referenceType);
    }
  });

  it('carries recommendsProposalDraft as advisory data only', () => {
    const flagged = buildPlanningItem({ recommendsProposalDraft: true });
    expect(flagged.recommendsProposalDraft).toBe(true);
    // Omittable — advisory only.
    expect(buildPlanningItem().recommendsProposalDraft).toBeUndefined();
  });

  it('carries monetaryAmount and currency as metadata only', () => {
    const withMoney = buildPlanningItem({ monetaryAmount: 12000, currency: 'USD' });
    expect(withMoney.monetaryAmount).toBe(12000);
    expect(withMoney.currency).toBe('USD');
    // Optional metadata — absent by default.
    expect(buildPlanningItem().monetaryAmount).toBeUndefined();
    expect(buildPlanningItem().currency).toBeUndefined();
  });

  it('carries ExecutionDomain values as opaque structural tags on the planning item', () => {
    const item = buildPlanningItem({
      executionDomains: [
        ExecutionDomain.CRM,
        ExecutionDomain.Reporting,
        ExecutionDomain.Automation,
      ],
    });
    expect(item.executionDomains).toHaveLength(3);
    expect(item.executionDomains).toContain(ExecutionDomain.Reporting);
  });

  it('constructs a RevenueInput batching multiple planning items', () => {
    const input: RevenueInput = {
      clientId: 'client-1',
      organizationId: 'org-1',
      planningItems: [
        buildPlanningItem({ id: 'rev-plan-1' }),
        buildPlanningItem({ id: 'rev-plan-2', planType: 'RENEWAL' }),
      ],
      generatedAt: '2026-07-11T00:00:00.000Z',
    };
    expect(input.planningItems).toHaveLength(2);
    expect(input.planningItems.map((p) => p.id)).toEqual(['rev-plan-1', 'rev-plan-2']);
    expect(input.generatedAt).toBe('2026-07-11T00:00:00.000Z');
  });

  it('treats clientId/organizationId on RevenueInput as provenance/scope only', () => {
    const input: RevenueInput = {
      clientId: 'provenance-client',
      organizationId: 'provenance-org',
      planningItems: [],
      generatedAt: '2026-07-11T00:00:00.000Z',
    };
    // Present for provenance; ClientContext remains authoritative for output scoping.
    expect(input.clientId).toBe('provenance-client');
    expect(input.organizationId).toBe('provenance-org');
  });

  it('accepts every declared RevenuePlanType (and excludes PROPOSAL_DRAFT)', () => {
    const types: readonly RevenuePlanType[] = [
      'UPSELL',
      'CROSS_SELL',
      'RENEWAL',
      'EXPANSION',
      'RETENTION',
      'PRICING_PACKAGING',
    ];
    expect(types).toHaveLength(6);
    expect(types).not.toContain('PROPOSAL_DRAFT' as RevenuePlanType);
  });

  it('accepts every declared RevenuePlanTargetKind (and excludes DEAL)', () => {
    const kinds: readonly RevenuePlanTargetKind[] = [
      'ACCOUNT',
      'ENGAGEMENT',
      'CONTRACT',
      'SUBSCRIPTION',
      'OPPORTUNITY',
    ];
    expect(kinds).toHaveLength(5);
    expect(kinds).not.toContain('DEAL' as RevenuePlanTargetKind);
  });

  it('accepts every declared priority, value, and effort band', () => {
    const priorities: readonly RevenuePlanPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
    const values: readonly RevenuePlanValueBand[] = ['LOW', 'MEDIUM', 'HIGH'];
    const bands: readonly RevenueEffortBand[] = ['LOW', 'MEDIUM', 'HIGH'];
    expect(priorities).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(values).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(bands).toEqual(['LOW', 'MEDIUM', 'HIGH']);
  });
});
