import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import type { OperationsInput, OperationsPlanningInputItem } from '@age/operations-contracts';
import { deriveOperationsPlanCandidates } from '../../processing/derive-operations-plan-candidates';

function buildItem(
  overrides: Partial<OperationsPlanningInputItem> = {},
): OperationsPlanningInputItem {
  return {
    id: 'ops-plan-1',
    planType: 'PROJECT_PLAN',
    reference: {
      referenceId: 'ref-1',
      referenceType: 'AUTHORITY_PLAN',
      target: { kind: 'PROJECT', key: 'project:acme' },
      executionDomains: [ExecutionDomain.CRM, ExecutionDomain.Publishing],
      urgencyScore: 60,
      deliveryRiskScore: 40,
      confidenceScore: 55,
    },
    executionDomains: [ExecutionDomain.Reporting],
    operationalUrgency: 80,
    deliveryRisk: 50,
    estimatedEffort: 40,
    confidence: 70,
    ...overrides,
  };
}

function buildInput(items: readonly OperationsPlanningInputItem[]): OperationsInput {
  return {
    clientId: 'input-client',
    organizationId: 'input-org',
    planningItems: items,
    generatedAt: '2026-07-11T00:00:00.000Z',
  };
}

describe('deriveOperationsPlanCandidates', () => {
  it('produces exactly one candidate per planning item', () => {
    const candidates = deriveOperationsPlanCandidates(
      buildInput([buildItem({ id: 'a' }), buildItem({ id: 'b' }), buildItem({ id: 'c' })]),
    );
    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.operationsPlanId)).toEqual(['a', 'b', 'c']);
  });

  it('carries planType, id, and target from the planning item / reference', () => {
    const [candidate] = deriveOperationsPlanCandidates(
      buildInput([buildItem({ id: 'ops-9', planType: 'QA_PLAN' })]),
    );
    expect(candidate?.operationsPlanId).toBe('ops-9');
    expect(candidate?.planType).toBe('QA_PLAN');
    expect(candidate?.target).toEqual({ kind: 'PROJECT', key: 'project:acme' });
  });

  it('uses item.executionDomains as authoritative, not reference.executionDomains', () => {
    const [candidate] = deriveOperationsPlanCandidates(buildInput([buildItem()]));
    expect(candidate?.executionDomains).toEqual([ExecutionDomain.Reporting]);
    expect(candidate?.executionDomains).not.toContain(ExecutionDomain.CRM);
    expect(candidate?.executionDomains).not.toContain(ExecutionDomain.Publishing);
  });

  it('carries the four scoring inputs verbatim', () => {
    const [candidate] = deriveOperationsPlanCandidates(buildInput([buildItem()]));
    expect(candidate?.operationalUrgency).toBe(80);
    expect(candidate?.deliveryRisk).toBe(50);
    expect(candidate?.estimatedEffort).toBe(40);
    expect(candidate?.confidence).toBe(70);
  });

  it('builds a single source ref preserving both referenceId and referenceType', () => {
    const [candidate] = deriveOperationsPlanCandidates(
      buildInput([
        buildItem({
          reference: {
            referenceId: 'growth-7',
            referenceType: 'GROWTH_PLAN',
            target: { kind: 'DELIVERABLE', key: 'deliv:x' },
            executionDomains: [],
            urgencyScore: 0,
            deliveryRiskScore: 0,
            confidenceScore: 0,
          },
        }),
      ]),
    );
    expect(candidate?.sourceRefs).toEqual([
      { referenceId: 'growth-7', referenceType: 'GROWTH_PLAN' },
    ]);
  });

  it('returns an empty list for empty input', () => {
    expect(deriveOperationsPlanCandidates(buildInput([]))).toHaveLength(0);
  });
});
