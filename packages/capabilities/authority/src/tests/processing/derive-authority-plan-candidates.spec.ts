import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import type { AuthorityInput, AuthorityPlanningInputItem } from '@age/authority-contracts';
import { deriveAuthorityPlanCandidates } from '../../processing/derive-authority-plan-candidates';

function buildPlanningItem(
  overrides: Partial<AuthorityPlanningInputItem> = {},
): AuthorityPlanningInputItem {
  return {
    id: 'plan-1',
    planType: 'CONTENT_STRATEGY',
    reference: {
      referenceId: 'ref-1',
      referenceType: 'OPPORTUNITY',
      target: { kind: 'OPPORTUNITY', key: 'opp:signal-1' },
      executionDomains: [ExecutionDomain.SEO],
      impactScore: 70,
      confidenceScore: 65,
    },
    executionDomains: [ExecutionDomain.Content],
    expectedImpact: 80,
    confidence: 70,
    estimatedEffort: 40,
    ...overrides,
  };
}

function buildInput(items: readonly AuthorityPlanningInputItem[]): AuthorityInput {
  return {
    clientId: 'client-1',
    organizationId: 'org-1',
    planningItems: items,
    generatedAt: '2026-07-10T00:00:00.000Z',
  };
}

describe('deriveAuthorityPlanCandidates', () => {
  it('produces exactly one candidate per planning item', () => {
    const candidates = deriveAuthorityPlanCandidates(
      buildInput([
        buildPlanningItem({ id: 'plan-1' }),
        buildPlanningItem({ id: 'plan-2' }),
        buildPlanningItem({ id: 'plan-3' }),
      ]),
    );
    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.authorityPlanId)).toEqual(['plan-1', 'plan-2', 'plan-3']);
  });

  it('returns an empty list for empty input', () => {
    expect(deriveAuthorityPlanCandidates(buildInput([]))).toEqual([]);
  });

  it('carries the caller-provided planType', () => {
    const [candidate] = deriveAuthorityPlanCandidates(
      buildInput([buildPlanningItem({ planType: 'THOUGHT_LEADERSHIP' })]),
    );
    expect(candidate?.planType).toBe('THOUGHT_LEADERSHIP');
  });

  it('uses the reference target as the candidate target', () => {
    const [candidate] = deriveAuthorityPlanCandidates(
      buildInput([
        buildPlanningItem({
          reference: {
            referenceId: 'ref-9',
            referenceType: 'GROWTH_PLAN',
            target: { kind: 'TOPIC', key: 'topic:api-security' },
            executionDomains: [ExecutionDomain.PR],
            impactScore: 50,
            confidenceScore: 40,
          },
        }),
      ]),
    );
    expect(candidate?.target).toEqual({ kind: 'TOPIC', key: 'topic:api-security' });
  });

  it('creates a source ref carrying both referenceId and referenceType', () => {
    const [candidate] = deriveAuthorityPlanCandidates(
      buildInput([
        buildPlanningItem({
          id: 'plan-7',
          reference: {
            referenceId: 'ref-77',
            referenceType: 'DECISION',
            target: { kind: 'ENTITY', key: 'entity:techcrunch' },
            executionDomains: [ExecutionDomain.PR],
            impactScore: 10,
            confidenceScore: 10,
          },
        }),
      ]),
    );
    expect(candidate?.authorityPlanId).toBe('plan-7');
    expect(candidate?.sourceRefs).toEqual([{ referenceId: 'ref-77', referenceType: 'DECISION' }]);
  });

  it('takes execution domains from the item, not from reference.executionDomains', () => {
    const [candidate] = deriveAuthorityPlanCandidates(
      buildInput([
        buildPlanningItem({
          executionDomains: [ExecutionDomain.Content, ExecutionDomain.Email],
          reference: {
            referenceId: 'ref-1',
            referenceType: 'OPPORTUNITY',
            target: { kind: 'OPPORTUNITY', key: 'opp:signal-1' },
            executionDomains: [ExecutionDomain.SEO, ExecutionDomain.PR],
            impactScore: 70,
            confidenceScore: 65,
          },
        }),
      ]),
    );
    expect(candidate?.executionDomains).toEqual([ExecutionDomain.Content, ExecutionDomain.Email]);
    expect(candidate?.executionDomains).not.toContain(ExecutionDomain.SEO);
    expect(candidate?.executionDomains).not.toContain(ExecutionDomain.PR);
  });

  it('carries only the explicit scoring inputs', () => {
    const [candidate] = deriveAuthorityPlanCandidates(
      buildInput([buildPlanningItem({ expectedImpact: 61, confidence: 42, estimatedEffort: 55 })]),
    );
    expect(candidate?.expectedImpact).toBe(61);
    expect(candidate?.confidence).toBe(42);
    expect(candidate?.estimatedEffort).toBe(55);
  });

  it('is deterministic for the same input', () => {
    const input = buildInput([
      buildPlanningItem({ id: 'plan-1' }),
      buildPlanningItem({ id: 'plan-2' }),
    ]);
    expect(deriveAuthorityPlanCandidates(input)).toEqual(deriveAuthorityPlanCandidates(input));
  });
});
