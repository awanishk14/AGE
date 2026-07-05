import { describe, expect, it } from 'vitest';
import { Capability, ClientContext, ExecutionDomain } from '@age/capability-kit';
import type { AuthorityInput, AuthorityPlanningInputItem } from '@age/authority-contracts';
import { processAuthority } from '../../processing/process-authority';
import type { AuthorityResult } from '../../authority-result';

const RUN_AT = '2026-07-10T00:00:00.000Z';
const context = new ClientContext('client-1', 'org-1');

/**
 * A deterministic view of an AuthorityResult that excludes CapabilityOutput's
 * wall-clock `producedAt` (set via `new Date()` in the CapabilityOutput
 * constructor). Repeated-run equivalence must be asserted on this view, never on
 * the full result object.
 */
function deterministicResultView(result: AuthorityResult) {
  return {
    output: {
      clientId: result.output.clientId,
      organizationId: result.output.organizationId,
      capability: result.output.capability,
      executionDomains: result.output.executionDomains,
      items: result.output.items,
    },
    summary: result.summary,
  };
}

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

function buildInput(
  items: readonly AuthorityPlanningInputItem[],
  overrides: Partial<AuthorityInput> = {},
): AuthorityInput {
  return {
    clientId: 'input-client',
    organizationId: 'input-org',
    planningItems: items,
    generatedAt: RUN_AT,
    ...overrides,
  };
}

describe('processAuthority', () => {
  it('returns empty output and a zeroed summary for empty input', () => {
    const result = processAuthority(context, buildInput([]));

    expect(result.output.items).toEqual([]);
    expect(result.output.executionDomains).toEqual([]);
    expect(result.summary).toEqual({
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      rejectedReasons: [],
      duplicateReferences: [],
    });
  });

  it('produces one item per accepted candidate with the correct mapping', () => {
    const result = processAuthority(context, buildInput([buildPlanningItem({ id: 'plan-1' })]));

    expect(result.output.items).toHaveLength(1);
    const [item] = result.output.items;
    expect(item?.id).toBe('plan-1');
    expect(item?.authorityPlanId).toBe('plan-1');
    expect(item?.capability).toBe(Capability.Authority);
    expect(item?.planType).toBe('CONTENT_STRATEGY');
    expect(item?.target).toEqual({ kind: 'OPPORTUNITY', key: 'opp:signal-1' });
    expect(item?.executionDomains).toEqual([ExecutionDomain.Content]);
    // impact round(0.6*80 + 0.4*70) = round(76) = 76; effort 40 -> MEDIUM
    // priorityScore round(0.7*76 + 0.3*60) = round(71.2) = 71 -> HIGH
    expect(item?.impactScore).toBe(76);
    expect(item?.effortScore).toBe(40);
    expect(item?.effortBand).toBe('MEDIUM');
    expect(item?.confidenceScore).toBe(70);
    expect(item?.priority).toBe('HIGH');
    expect(item?.createdAt).toEqual(new Date(RUN_AT));
    expect(item?.sourceRefs).toEqual([{ referenceId: 'ref-1', referenceType: 'OPPORTUNITY' }]);
  });

  it('takes item execution domains from the planning item, not reference.executionDomains', () => {
    const result = processAuthority(
      context,
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
    const [item] = result.output.items;
    expect(item?.executionDomains).toEqual([ExecutionDomain.Content, ExecutionDomain.Email]);
    expect(item?.executionDomains).not.toContain(ExecutionDomain.SEO);
    expect(item?.executionDomains).not.toContain(ExecutionDomain.PR);
    // envelope union also excludes reference-only domains
    expect(result.output.executionDomains).not.toContain(ExecutionDomain.SEO);
    expect(result.output.executionDomains).not.toContain(ExecutionDomain.PR);
  });

  describe('with a mixed valid / invalid / duplicate batch', () => {
    const valid = buildPlanningItem({ id: 'valid-1' });
    const invalid = buildPlanningItem({ id: 'invalid-1', confidence: 999 }); // INVALID_CONFIDENCE
    const duplicateOfValid = buildPlanningItem({
      id: 'dup-1',
      reference: {
        referenceId: 'ref-2',
        referenceType: 'GROWTH_PLAN',
        target: { kind: 'OPPORTUNITY', key: 'opp:signal-1' }, // same target as valid-1
        executionDomains: [ExecutionDomain.SEO],
        impactScore: 50,
        confidenceScore: 50,
      },
    });
    const distinct = buildPlanningItem({
      id: 'distinct-1',
      planType: 'THOUGHT_LEADERSHIP',
      reference: {
        referenceId: 'ref-3',
        referenceType: 'OPPORTUNITY',
        target: { kind: 'TOPIC', key: 'topic:api-security' },
        executionDomains: [ExecutionDomain.PR],
        impactScore: 40,
        confidenceScore: 40,
      },
      executionDomains: [ExecutionDomain.PR],
    });

    const input = buildInput([valid, invalid, duplicateOfValid, distinct]);
    const result = processAuthority(context, input);
    const outputIds = result.output.items.map((item) => item.authorityPlanId);

    it('excludes rejected candidates from output.items', () => {
      expect(outputIds).not.toContain('invalid-1');
    });

    it('excludes duplicate candidates from output.items', () => {
      expect(outputIds).not.toContain('dup-1');
    });

    it('records the rejection reason exactly once with a constrained code', () => {
      expect(result.summary.rejectedReasons).toEqual([
        {
          authorityPlanId: 'invalid-1',
          reasonCode: 'INVALID_CONFIDENCE',
          detail: expect.any(String),
        },
      ]);
    });

    it('records the duplicate reference exactly once, pointing at the first-seen original', () => {
      expect(result.summary.duplicateReferences).toEqual([
        { authorityPlanId: 'dup-1', duplicateOfAuthorityPlanId: 'valid-1' },
      ]);
    });

    it('merges the duplicate source refs into the accepted original item, preserving referenceType', () => {
      const validItem = result.output.items.find((item) => item.authorityPlanId === 'valid-1');
      expect(validItem?.sourceRefs).toEqual([
        { referenceId: 'ref-1', referenceType: 'OPPORTUNITY' },
        { referenceId: 'ref-2', referenceType: 'GROWTH_PLAN' },
      ]);
    });

    it('satisfies the ADR-0017 accounting invariants', () => {
      const { acceptedCount, rejectedCount, duplicateCount } = result.summary;
      const derivedCount = input.planningItems.length; // 1 item -> 1 candidate

      expect(acceptedCount + rejectedCount + duplicateCount).toBe(derivedCount);
      expect(result.summary.rejectedReasons).toHaveLength(rejectedCount);
      expect(result.summary.duplicateReferences).toHaveLength(duplicateCount);
      expect(result.output.items).toHaveLength(acceptedCount);
      expect(acceptedCount).toBe(2); // valid-1 (+merged dup-1) and distinct-1
    });

    it('lists each rejected and duplicate id exactly once and never in output', () => {
      const rejectedIds = result.summary.rejectedReasons.map((r) => r.authorityPlanId);
      const duplicateIds = result.summary.duplicateReferences.map((d) => d.authorityPlanId);
      expect(new Set(rejectedIds).size).toBe(rejectedIds.length);
      expect(new Set(duplicateIds).size).toBe(duplicateIds.length);
      for (const id of [...rejectedIds, ...duplicateIds]) {
        expect(outputIds).not.toContain(id);
      }
    });
  });

  it('scopes the output by ClientContext, not by the input', () => {
    const authoritative = new ClientContext('authoritative-client', 'authoritative-org');
    const result = processAuthority(
      authoritative,
      buildInput([buildPlanningItem()], { clientId: 'input-client', organizationId: 'input-org' }),
    );

    expect(result.output.clientId).toBe('authoritative-client');
    expect(result.output.organizationId).toBe('authoritative-org');
    expect(result.output.clientId).not.toBe('input-client');
  });

  it('uses input.generatedAt for every item createdAt deterministically', () => {
    const result = processAuthority(
      context,
      buildInput([
        buildPlanningItem({ id: 'p1' }),
        buildPlanningItem({
          id: 'p2',
          reference: {
            referenceId: 'ref-x',
            referenceType: 'OPPORTUNITY',
            target: { kind: 'TOPIC', key: 'topic:x' },
            executionDomains: [ExecutionDomain.PR],
            impactScore: 10,
            confidenceScore: 10,
          },
          executionDomains: [ExecutionDomain.PR],
        }),
      ]),
    );
    expect(result.output.items).toHaveLength(2);
    for (const item of result.output.items) {
      expect(item.createdAt).toEqual(new Date(RUN_AT));
    }
  });

  it('derives the output envelope executionDomains from accepted items only, deduplicated and sorted', () => {
    const result = processAuthority(
      context,
      buildInput([
        buildPlanningItem({ id: 'p1', executionDomains: [ExecutionDomain.Content] }),
        buildPlanningItem({
          id: 'p2',
          reference: {
            referenceId: 'ref-2',
            referenceType: 'OPPORTUNITY',
            target: { kind: 'TOPIC', key: 'topic:x' },
            executionDomains: [ExecutionDomain.SEO],
            impactScore: 10,
            confidenceScore: 10,
          },
          executionDomains: [ExecutionDomain.PR, ExecutionDomain.Content],
        }),
      ]),
    );
    expect(result.output.executionDomains).toEqual(
      [ExecutionDomain.Content, ExecutionDomain.PR].sort(),
    );
  });

  it('returns an equivalent result on repeated runs with the same input', () => {
    const input = buildInput([
      buildPlanningItem({ id: 'p1' }),
      buildPlanningItem({
        id: 'p2',
        reference: {
          referenceId: 'ref-2',
          referenceType: 'OPPORTUNITY',
          target: { kind: 'TOPIC', key: 'topic:x' },
          executionDomains: [ExecutionDomain.PR],
          impactScore: 10,
          confidenceScore: 10,
        },
        executionDomains: [ExecutionDomain.PR],
      }),
    ]);
    expect(deterministicResultView(processAuthority(context, input))).toEqual(
      deterministicResultView(processAuthority(context, input)),
    );
  });
});
