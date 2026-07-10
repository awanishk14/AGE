import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import type {
  AuthorityEffortBand,
  AuthorityInput,
  AuthorityPlanningInputItem,
  AuthorityPlanPriority,
  AuthorityPlanReference,
  AuthorityPlanSourceRef,
  AuthorityPlanTarget,
  AuthorityPlanTargetKind,
  AuthorityPlanType,
} from '../index';

function buildReference(overrides: Partial<AuthorityPlanReference> = {}): AuthorityPlanReference {
  const target: AuthorityPlanTarget = { kind: 'TOPIC', key: 'topic:api-security' };
  return {
    referenceId: 'opp-1',
    referenceType: 'OPPORTUNITY',
    target,
    executionDomains: [ExecutionDomain.Content],
    impactScore: 70,
    confidenceScore: 65,
    ...overrides,
  };
}

function buildPlanningItem(
  overrides: Partial<AuthorityPlanningInputItem> = {},
): AuthorityPlanningInputItem {
  return {
    id: 'plan-1',
    planType: 'THOUGHT_LEADERSHIP',
    reference: buildReference(),
    executionDomains: [ExecutionDomain.Content],
    expectedImpact: 80,
    confidence: 70,
    estimatedEffort: 40,
    ...overrides,
  };
}

describe('@age/authority-contracts', () => {
  it('constructs a well-formed AuthorityPlanningInputItem with explicit scoring inputs', () => {
    const item = buildPlanningItem();
    expect(item.planType).toBe('THOUGHT_LEADERSHIP');
    expect(item.expectedImpact).toBe(80);
    expect(item.confidence).toBe(70);
    expect(item.estimatedEffort).toBe(40);
  });

  it('carries a caller-provided planType (not derived)', () => {
    const pr = buildPlanningItem({ planType: 'DIGITAL_PR' });
    expect(pr.planType).toBe('DIGITAL_PR');
  });

  it('references an upstream concept via a neutral value shape carrying id and type', () => {
    const ref = buildReference({ referenceId: 'growth-9', referenceType: 'GROWTH_PLAN' });
    expect(ref.referenceId).toBe('growth-9');
    expect(ref.referenceType).toBe('GROWTH_PLAN');
    expect(ref.target).toEqual({ kind: 'TOPIC', key: 'topic:api-security' });
  });

  it('allows an AuthorityPlanTarget of any declared kind', () => {
    const entityTarget: AuthorityPlanTarget = { kind: 'ENTITY', key: 'entity:techcrunch' };
    const ref = buildReference({ target: entityTarget });
    expect(ref.target.kind).toBe('ENTITY');
  });

  it('carries ExecutionDomain values as opaque structural tags on the planning item', () => {
    const item = buildPlanningItem({
      executionDomains: [ExecutionDomain.Content, ExecutionDomain.PR, ExecutionDomain.Publishing],
    });
    expect(item.executionDomains).toHaveLength(3);
    expect(item.executionDomains).toContain(ExecutionDomain.PR);
  });

  it('constructs an AuthorityPlanSourceRef preserving referenceId and referenceType', () => {
    const ref: AuthorityPlanSourceRef = { referenceId: 'opp-1', referenceType: 'OPPORTUNITY' };
    expect(ref.referenceId).toBe('opp-1');
    expect(ref.referenceType).toBe('OPPORTUNITY');
  });

  it('constructs an AuthorityInput batching multiple planning items', () => {
    const input: AuthorityInput = {
      clientId: 'client-1',
      organizationId: 'org-1',
      planningItems: [
        buildPlanningItem({ id: 'plan-1' }),
        buildPlanningItem({ id: 'plan-2', planType: 'BACKLINK' }),
      ],
      generatedAt: '2026-07-10T00:00:00.000Z',
    };
    expect(input.planningItems).toHaveLength(2);
    expect(input.planningItems.map((p) => p.id)).toEqual(['plan-1', 'plan-2']);
    expect(input.generatedAt).toBe('2026-07-10T00:00:00.000Z');
  });

  it('accepts every declared AuthorityPlanType', () => {
    const types: readonly AuthorityPlanType[] = [
      'CONTENT_STRATEGY',
      'THOUGHT_LEADERSHIP',
      'DIGITAL_PR',
      'BACKLINK',
      'REVIEW',
      'VIDEO',
      'PODCAST',
    ];
    expect(types).toHaveLength(7);
  });

  it('accepts every declared AuthorityPlanTargetKind', () => {
    const kinds: readonly AuthorityPlanTargetKind[] = [
      'OPPORTUNITY',
      'TOPIC',
      'AUDIENCE',
      'ENTITY',
    ];
    expect(kinds).toHaveLength(4);
  });

  it('accepts every declared AuthorityPlanPriority and AuthorityEffortBand', () => {
    const priorities: readonly AuthorityPlanPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
    const bands: readonly AuthorityEffortBand[] = ['LOW', 'MEDIUM', 'HIGH'];
    expect(priorities).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(bands).toEqual(['LOW', 'MEDIUM', 'HIGH']);
  });
});
