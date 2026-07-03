import { describe, expect, it } from 'vitest';
import { Capability, ClientContext, ExecutionDomain } from '@age/capability-kit';
import type { GrowthInput, GrowthPlanningInputItem } from '@age/growth-contracts';
import { processGrowth } from '../../processing/process-growth';

const RUN_AT = '2026-07-10T00:00:00.000Z';
const context = new ClientContext('client-1', 'org-1');

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

function buildInput(
  items: readonly GrowthPlanningInputItem[],
  overrides: Partial<GrowthInput> = {},
): GrowthInput {
  return {
    clientId: 'input-client',
    organizationId: 'input-org',
    planningItems: items,
    generatedAt: RUN_AT,
    ...overrides,
  };
}

describe('processGrowth', () => {
  it('returns empty output and a zeroed summary for empty input', () => {
    const result = processGrowth(context, buildInput([]));

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
    const result = processGrowth(context, buildInput([buildPlanningItem({ id: 'plan-1' })]));

    expect(result.output.items).toHaveLength(1);
    const [item] = result.output.items;
    expect(item?.id).toBe('plan-1');
    expect(item?.planId).toBe('plan-1');
    expect(item?.capability).toBe(Capability.Growth);
    expect(item?.planType).toBe('PAID_ACQUISITION');
    expect(item?.target).toEqual({ kind: 'OPPORTUNITY', key: 'opp:signal-1' });
    expect(item?.executionDomains).toEqual([ExecutionDomain.GoogleAds]);
    // impact round(0.6*80 + 0.4*70) = round(76) = 76; effort 40 -> MEDIUM
    // priorityScore round(0.7*76 + 0.3*60) = round(71.2) = 71 -> HIGH
    expect(item?.impactScore).toBe(76);
    expect(item?.effortScore).toBe(40);
    expect(item?.effortBand).toBe('MEDIUM');
    expect(item?.confidenceScore).toBe(70);
    expect(item?.priority).toBe('HIGH');
    expect(item?.createdAt).toEqual(new Date(RUN_AT));
    expect(item?.sourceRefs).toEqual([{ opportunityId: 'opp-1' }]);
  });

  describe('with a mixed valid / invalid / duplicate batch', () => {
    const valid = buildPlanningItem({ id: 'valid-1' });
    const invalid = buildPlanningItem({ id: 'invalid-1', confidence: 999 }); // INVALID_CONFIDENCE
    const duplicateOfValid = buildPlanningItem({
      id: 'dup-1',
      opportunity: {
        opportunityId: 'opp-2',
        opportunityType: 'VISIBILITY',
        target: { kind: 'OPPORTUNITY', key: 'opp:signal-1' }, // same target as valid-1
        executionDomains: [ExecutionDomain.GoogleAds],
        impactScore: 50,
        confidenceScore: 50,
      },
    });
    const distinct = buildPlanningItem({
      id: 'distinct-1',
      planType: 'CONVERSION_OPTIMIZATION',
      opportunity: {
        opportunityId: 'opp-3',
        opportunityType: 'CONVERSION',
        target: { kind: 'FUNNEL_STAGE', key: 'funnel:checkout' },
        executionDomains: [ExecutionDomain.CRO],
        impactScore: 40,
        confidenceScore: 40,
      },
      executionDomains: [ExecutionDomain.CRO],
    });

    const input = buildInput([valid, invalid, duplicateOfValid, distinct]);
    const result = processGrowth(context, input);
    const outputIds = result.output.items.map((item) => item.planId);

    it('excludes rejected candidates from output.items', () => {
      expect(outputIds).not.toContain('invalid-1');
    });

    it('excludes duplicate candidates from output.items', () => {
      expect(outputIds).not.toContain('dup-1');
    });

    it('records the rejection reason exactly once with a constrained code', () => {
      expect(result.summary.rejectedReasons).toEqual([
        { planId: 'invalid-1', reasonCode: 'INVALID_CONFIDENCE', detail: expect.any(String) },
      ]);
    });

    it('records the duplicate reference exactly once, pointing at the first-seen original', () => {
      expect(result.summary.duplicateReferences).toEqual([
        { planId: 'dup-1', duplicateOfPlanId: 'valid-1' },
      ]);
    });

    it('merges the duplicate source refs into the accepted original item', () => {
      const validItem = result.output.items.find((item) => item.planId === 'valid-1');
      expect(validItem?.sourceRefs).toEqual([
        { opportunityId: 'opp-1' },
        { opportunityId: 'opp-2' },
      ]);
    });

    it('satisfies the ADR-0015 accounting invariants', () => {
      const { acceptedCount, rejectedCount, duplicateCount } = result.summary;
      const derivedCount = input.planningItems.length; // 1 item -> 1 candidate

      expect(acceptedCount + rejectedCount + duplicateCount).toBe(derivedCount);
      expect(result.summary.rejectedReasons).toHaveLength(rejectedCount);
      expect(result.summary.duplicateReferences).toHaveLength(duplicateCount);
      expect(result.output.items).toHaveLength(acceptedCount);
      expect(acceptedCount).toBe(2); // valid-1 (+merged dup-1) and distinct-1
    });

    it('lists each rejected and duplicate id exactly once and never in output', () => {
      const rejectedIds = result.summary.rejectedReasons.map((r) => r.planId);
      const duplicateIds = result.summary.duplicateReferences.map((d) => d.planId);
      expect(new Set(rejectedIds).size).toBe(rejectedIds.length);
      expect(new Set(duplicateIds).size).toBe(duplicateIds.length);
      for (const id of [...rejectedIds, ...duplicateIds]) {
        expect(outputIds).not.toContain(id);
      }
    });
  });

  it('scopes the output by ClientContext, not by the input', () => {
    const authoritative = new ClientContext('authoritative-client', 'authoritative-org');
    const result = processGrowth(
      authoritative,
      buildInput([buildPlanningItem()], { clientId: 'input-client', organizationId: 'input-org' }),
    );

    expect(result.output.clientId).toBe('authoritative-client');
    expect(result.output.organizationId).toBe('authoritative-org');
    expect(result.output.clientId).not.toBe('input-client');
  });

  it('uses input.generatedAt for every item createdAt deterministically', () => {
    const result = processGrowth(
      context,
      buildInput([
        buildPlanningItem({ id: 'p1' }),
        buildPlanningItem({
          id: 'p2',
          opportunity: {
            opportunityId: 'opp-x',
            opportunityType: 'CONVERSION',
            target: { kind: 'FUNNEL_STAGE', key: 'funnel:x' },
            executionDomains: [ExecutionDomain.CRO],
            impactScore: 10,
            confidenceScore: 10,
          },
          executionDomains: [ExecutionDomain.CRO],
        }),
      ]),
    );
    for (const item of result.output.items) {
      expect(item.createdAt).toEqual(new Date(RUN_AT));
    }
  });

  it('derives the output envelope executionDomains from accepted items only, deduplicated and sorted', () => {
    const result = processGrowth(
      context,
      buildInput([
        buildPlanningItem({ id: 'p1', executionDomains: [ExecutionDomain.GoogleAds] }),
        buildPlanningItem({
          id: 'p2',
          opportunity: {
            opportunityId: 'opp-2',
            opportunityType: 'CONVERSION',
            target: { kind: 'FUNNEL_STAGE', key: 'funnel:x' },
            executionDomains: [ExecutionDomain.CRO],
            impactScore: 10,
            confidenceScore: 10,
          },
          executionDomains: [ExecutionDomain.CRO, ExecutionDomain.GoogleAds],
        }),
      ]),
    );
    expect(result.output.executionDomains).toEqual(
      [ExecutionDomain.CRO, ExecutionDomain.GoogleAds].sort(),
    );
  });

  it('returns an equivalent result on repeated runs with the same input', () => {
    const input = buildInput([
      buildPlanningItem({ id: 'p1' }),
      buildPlanningItem({
        id: 'p2',
        opportunity: {
          opportunityId: 'opp-2',
          opportunityType: 'CONVERSION',
          target: { kind: 'FUNNEL_STAGE', key: 'funnel:x' },
          executionDomains: [ExecutionDomain.CRO],
          impactScore: 10,
          confidenceScore: 10,
        },
        executionDomains: [ExecutionDomain.CRO],
      }),
    ]);
    expect(processGrowth(context, input)).toEqual(processGrowth(context, input));
  });
});
