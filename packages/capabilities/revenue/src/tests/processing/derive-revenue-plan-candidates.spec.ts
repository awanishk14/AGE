import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import type { RevenueInput, RevenuePlanningInputItem } from '@age/revenue-contracts';
import { deriveRevenuePlanCandidates } from '../../processing/derive-revenue-plan-candidates';

function buildItem(overrides: Partial<RevenuePlanningInputItem> = {}): RevenuePlanningInputItem {
  return {
    id: 'rev-plan-1',
    planType: 'UPSELL',
    reference: {
      referenceId: 'ops-1',
      referenceType: 'OPERATIONS_PLAN',
      target: { kind: 'ACCOUNT', key: 'account:acme' },
      executionDomains: [ExecutionDomain.CRM, ExecutionDomain.Reporting],
      expectedValueScore: 60,
      conversionProbabilityScore: 50,
      retentionRiskScore: 40,
      confidenceScore: 55,
    },
    executionDomains: [ExecutionDomain.Automation],
    expectedValue: 80,
    conversionProbability: 50,
    retentionRisk: 40,
    estimatedEffort: 40,
    confidence: 70,
    ...overrides,
  };
}

function buildInput(items: readonly RevenuePlanningInputItem[]): RevenueInput {
  return {
    clientId: 'input-client',
    organizationId: 'input-org',
    planningItems: items,
    generatedAt: '2026-07-12T00:00:00.000Z',
  };
}

describe('deriveRevenuePlanCandidates', () => {
  it('produces exactly one candidate per planning item', () => {
    const candidates = deriveRevenuePlanCandidates(
      buildInput([buildItem({ id: 'a' }), buildItem({ id: 'b' }), buildItem({ id: 'c' })]),
    );
    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.revenuePlanId)).toEqual(['a', 'b', 'c']);
  });

  it('carries revenuePlanId from the item id and planType from the item', () => {
    const [c] = deriveRevenuePlanCandidates(
      buildInput([buildItem({ id: 'rev-9', planType: 'RENEWAL' })]),
    );
    expect(c?.revenuePlanId).toBe('rev-9');
    expect(c?.planType).toBe('RENEWAL');
  });

  it('takes target from item.reference.target', () => {
    const [c] = deriveRevenuePlanCandidates(buildInput([buildItem()]));
    expect(c?.target).toEqual({ kind: 'ACCOUNT', key: 'account:acme' });
  });

  it('uses item.executionDomains as authoritative, not reference.executionDomains', () => {
    const [c] = deriveRevenuePlanCandidates(buildInput([buildItem()]));
    expect(c?.executionDomains).toEqual([ExecutionDomain.Automation]);
    expect(c?.executionDomains).not.toContain(ExecutionDomain.CRM);
    expect(c?.executionDomains).not.toContain(ExecutionDomain.Reporting);
  });

  it('builds a single source ref preserving referenceId/referenceType (incl. OPERATIONS_PLAN)', () => {
    const [c] = deriveRevenuePlanCandidates(buildInput([buildItem()]));
    expect(c?.sourceRefs).toEqual([{ referenceId: 'ops-1', referenceType: 'OPERATIONS_PLAN' }]);
  });

  it('copies all five scoring inputs verbatim', () => {
    const [c] = deriveRevenuePlanCandidates(buildInput([buildItem()]));
    expect(c?.expectedValue).toBe(80);
    expect(c?.conversionProbability).toBe(50);
    expect(c?.retentionRisk).toBe(40);
    expect(c?.estimatedEffort).toBe(40);
    expect(c?.confidence).toBe(70);
  });

  it('copies recommendsProposalDraft and monetary metadata when present', () => {
    const [c] = deriveRevenuePlanCandidates(
      buildInput([
        buildItem({ recommendsProposalDraft: true, monetaryAmount: 12000, currency: 'USD' }),
      ]),
    );
    expect(c?.recommendsProposalDraft).toBe(true);
    expect(c?.monetaryAmount).toBe(12000);
    expect(c?.currency).toBe('USD');
  });

  it('leaves optional advisory/metadata undefined when absent', () => {
    const [c] = deriveRevenuePlanCandidates(buildInput([buildItem()]));
    expect(c?.recommendsProposalDraft).toBeUndefined();
    expect(c?.monetaryAmount).toBeUndefined();
    expect(c?.currency).toBeUndefined();
  });

  it('returns an empty list for empty input (no generatedAt/clock behavior)', () => {
    expect(deriveRevenuePlanCandidates(buildInput([]))).toHaveLength(0);
  });
});
