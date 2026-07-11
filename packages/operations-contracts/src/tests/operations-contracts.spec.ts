import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import type {
  OperationsEffortBand,
  OperationsInput,
  OperationsPlanningInputItem,
  OperationsPlanPriority,
  OperationsPlanReference,
  OperationsPlanSourceRef,
  OperationsPlanTarget,
  OperationsPlanTargetKind,
  OperationsPlanType,
} from '../index';

function buildReference(overrides: Partial<OperationsPlanReference> = {}): OperationsPlanReference {
  const target: OperationsPlanTarget = { kind: 'PROJECT', key: 'project:acme-redesign' };
  return {
    referenceId: 'auth-1',
    referenceType: 'AUTHORITY_PLAN',
    target,
    executionDomains: [ExecutionDomain.Reporting],
    urgencyScore: 70,
    deliveryRiskScore: 55,
    confidenceScore: 65,
    ...overrides,
  };
}

function buildPlanningItem(
  overrides: Partial<OperationsPlanningInputItem> = {},
): OperationsPlanningInputItem {
  return {
    id: 'ops-plan-1',
    planType: 'PROJECT_PLAN',
    reference: buildReference(),
    executionDomains: [ExecutionDomain.Reporting],
    operationalUrgency: 80,
    deliveryRisk: 50,
    estimatedEffort: 40,
    confidence: 70,
    ...overrides,
  };
}

describe('@age/operations-contracts', () => {
  it('constructs a well-formed OperationsPlanningInputItem with explicit scoring inputs', () => {
    const item = buildPlanningItem();
    expect(item.planType).toBe('PROJECT_PLAN');
    expect(item.operationalUrgency).toBe(80);
    expect(item.deliveryRisk).toBe(50);
    expect(item.estimatedEffort).toBe(40);
    expect(item.confidence).toBe(70);
  });

  it('carries a caller-provided planType (not derived)', () => {
    const reporting = buildPlanningItem({ planType: 'CLIENT_REPORTING' });
    expect(reporting.planType).toBe('CLIENT_REPORTING');
  });

  it('references an upstream concept via a neutral value shape carrying id and type', () => {
    const ref = buildReference({ referenceId: 'growth-9', referenceType: 'GROWTH_PLAN' });
    expect(ref.referenceId).toBe('growth-9');
    expect(ref.referenceType).toBe('GROWTH_PLAN');
    expect(ref.target).toEqual({ kind: 'PROJECT', key: 'project:acme-redesign' });
    expect(ref.urgencyScore).toBe(70);
    expect(ref.deliveryRiskScore).toBe(55);
    expect(ref.confidenceScore).toBe(65);
  });

  it('allows an OperationsPlanTarget of any declared kind', () => {
    const assigneeTarget: OperationsPlanTarget = { kind: 'ASSIGNEE', key: 'assignee:jane-doe' };
    const ref = buildReference({ target: assigneeTarget });
    expect(ref.target.kind).toBe('ASSIGNEE');
  });

  it('carries ExecutionDomain values as opaque structural tags on the planning item', () => {
    const item = buildPlanningItem({
      executionDomains: [
        ExecutionDomain.Reporting,
        ExecutionDomain.Automation,
        ExecutionDomain.CRM,
      ],
    });
    expect(item.executionDomains).toHaveLength(3);
    expect(item.executionDomains).toContain(ExecutionDomain.Automation);
  });

  it('constructs an OperationsPlanSourceRef preserving referenceId and referenceType', () => {
    const ref: OperationsPlanSourceRef = { referenceId: 'auth-1', referenceType: 'AUTHORITY_PLAN' };
    expect(ref.referenceId).toBe('auth-1');
    expect(ref.referenceType).toBe('AUTHORITY_PLAN');
  });

  it('constructs an OperationsInput batching multiple planning items', () => {
    const input: OperationsInput = {
      clientId: 'client-1',
      organizationId: 'org-1',
      planningItems: [
        buildPlanningItem({ id: 'ops-plan-1' }),
        buildPlanningItem({ id: 'ops-plan-2', planType: 'QA_PLAN' }),
      ],
      generatedAt: '2026-07-11T00:00:00.000Z',
    };
    expect(input.planningItems).toHaveLength(2);
    expect(input.planningItems.map((p) => p.id)).toEqual(['ops-plan-1', 'ops-plan-2']);
    expect(input.generatedAt).toBe('2026-07-11T00:00:00.000Z');
  });

  it('treats clientId/organizationId on OperationsInput as provenance/scope only', () => {
    const input: OperationsInput = {
      clientId: 'provenance-client',
      organizationId: 'provenance-org',
      planningItems: [],
      generatedAt: '2026-07-11T00:00:00.000Z',
    };
    // Present for provenance; ClientContext remains authoritative for output scoping.
    expect(input.clientId).toBe('provenance-client');
    expect(input.organizationId).toBe('provenance-org');
  });

  it('accepts every declared OperationsPlanType', () => {
    const types: readonly OperationsPlanType[] = [
      'PROJECT_PLAN',
      'CLIENT_REPORTING',
      'TEAM_ASSIGNMENT',
      'SOP_EXECUTION',
      'QA_PLAN',
      'DELIVERY_TRACKING',
    ];
    expect(types).toHaveLength(6);
  });

  it('accepts every declared OperationsPlanTargetKind', () => {
    const kinds: readonly OperationsPlanTargetKind[] = [
      'PROJECT',
      'DELIVERABLE',
      'ENGAGEMENT',
      'ASSIGNEE',
      'SOP',
      'REPORT',
    ];
    expect(kinds).toHaveLength(6);
  });

  it('accepts every declared OperationsPlanPriority and OperationsEffortBand', () => {
    const priorities: readonly OperationsPlanPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
    const bands: readonly OperationsEffortBand[] = ['LOW', 'MEDIUM', 'HIGH'];
    expect(priorities).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(bands).toEqual(['LOW', 'MEDIUM', 'HIGH']);
  });
});
