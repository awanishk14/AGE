import { describe, expect, it } from 'vitest';
import { Capability, ClientContext, ExecutionDomain } from '@age/capability-kit';
import type { RevenueInput, RevenuePlanningInputItem } from '@age/revenue-contracts';
import { processRevenue } from '../../processing/process-revenue';
import type { RevenueResult } from '../../revenue-result';

function buildItem(overrides: Partial<RevenuePlanningInputItem> = {}): RevenuePlanningInputItem {
  return {
    id: 'rev-plan-1',
    planType: 'UPSELL',
    reference: {
      referenceId: 'ops-1',
      referenceType: 'OPERATIONS_PLAN',
      target: { kind: 'ACCOUNT', key: 'account:acme' },
      executionDomains: [ExecutionDomain.Reporting, ExecutionDomain.Automation],
      expectedValueScore: 60,
      conversionProbabilityScore: 50,
      retentionRiskScore: 40,
      confidenceScore: 55,
    },
    executionDomains: [ExecutionDomain.CRM],
    expectedValue: 80,
    conversionProbability: 50,
    retentionRisk: 40,
    estimatedEffort: 40,
    confidence: 70,
    ...overrides,
  };
}

function buildInput(overrides: Partial<RevenueInput> = {}): RevenueInput {
  return {
    clientId: 'input-client',
    organizationId: 'input-org',
    planningItems: [],
    generatedAt: '2026-07-12T00:00:00.000Z',
    ...overrides,
  };
}

/** Deterministic view of a result, excluding the wall-clock producedAt. */
function deterministicView(result: RevenueResult) {
  return {
    clientId: result.output.clientId,
    organizationId: result.output.organizationId,
    capability: result.output.capability,
    executionDomains: result.output.executionDomains,
    items: result.output.items,
    summary: result.summary,
  };
}

const ctx = new ClientContext('client-1', 'org-1');

describe('processRevenue', () => {
  it('returns empty items, empty executionDomains, and a zeroed summary for empty input', () => {
    const result = processRevenue(ctx, buildInput());
    expect(result.output.items).toHaveLength(0);
    expect(result.output.executionDomains).toEqual([]);
    expect(result.summary).toEqual({
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      rejectedReasons: [],
      duplicateReferences: [],
    });
  });

  it('produces one RevenuePlanItem for a valid planning item', () => {
    const result = processRevenue(ctx, buildInput({ planningItems: [buildItem()] }));
    expect(result.output.items).toHaveLength(1);
    const item = result.output.items[0];
    expect(item?.revenuePlanId).toBe('rev-plan-1');
    expect(item?.id).toBe('rev-plan-1');
    expect(item?.capability).toBe(Capability.Revenue);
    expect(item?.planType).toBe('UPSELL');
    expect(item?.target).toEqual({ kind: 'ACCOUNT', key: 'account:acme' });
    expect(item?.sourceRefs).toEqual([{ referenceId: 'ops-1', referenceType: 'OPERATIONS_PLAN' }]);
    expect(result.summary.acceptedCount).toBe(1);
  });

  it('scopes output by ClientContext, not by RevenueInput', () => {
    const authoritative = new ClientContext('authoritative-client', 'authoritative-org');
    const result = processRevenue(
      authoritative,
      buildInput({
        clientId: 'input-client',
        organizationId: 'input-org',
        planningItems: [buildItem()],
      }),
    );
    expect(result.output.clientId).toBe('authoritative-client');
    expect(result.output.organizationId).toBe('authoritative-org');
    expect(result.output.clientId).not.toBe('input-client');
    expect(result.output.organizationId).not.toBe('input-org');
  });

  it('sets each accepted item createdAt to new Date(input.generatedAt)', () => {
    const generatedAt = '2026-07-12T09:30:00.000Z';
    const result = processRevenue(ctx, buildInput({ generatedAt, planningItems: [buildItem()] }));
    expect(result.output.items[0]?.createdAt).toEqual(new Date(generatedAt));
    expect(result.output.items[0]?.createdAt.toISOString()).toBe(generatedAt);
  });

  it('keeps CapabilityOutput.producedAt present (wall-clock, not a deterministic assertion)', () => {
    const result = processRevenue(ctx, buildInput({ planningItems: [buildItem()] }));
    expect(result.output.producedAt).toBeInstanceOf(Date);
  });

  it('item execution domains come from the planning item, not the reference', () => {
    const result = processRevenue(ctx, buildInput({ planningItems: [buildItem()] }));
    expect(result.output.items[0]?.executionDomains).toEqual([ExecutionDomain.CRM]);
    expect(result.output.items[0]?.executionDomains).not.toContain(ExecutionDomain.Reporting);
  });

  it('envelope execution domains are the sorted, deduplicated union of accepted item domains', () => {
    const result = processRevenue(
      ctx,
      buildInput({
        planningItems: [
          buildItem({
            id: 'a',
            planType: 'UPSELL',
            executionDomains: [ExecutionDomain.Reporting, ExecutionDomain.CRM],
          }),
          buildItem({
            id: 'b',
            planType: 'RENEWAL',
            executionDomains: [ExecutionDomain.CRM, ExecutionDomain.Automation],
          }),
        ],
      }),
    );
    const expected = [
      ExecutionDomain.Automation,
      ExecutionDomain.CRM,
      ExecutionDomain.Reporting,
    ].sort();
    expect(result.output.executionDomains).toEqual(expected);
    expect(result.output.executionDomains.filter((d) => d === ExecutionDomain.CRM)).toHaveLength(1);
  });

  it('counts a rejected candidate in the summary and excludes it from output', () => {
    const result = processRevenue(
      ctx,
      buildInput({
        planningItems: [
          buildItem({ id: 'valid' }),
          buildItem({ id: 'invalid', executionDomains: [] }), // NO_EXECUTION_DOMAIN
        ],
      }),
    );
    expect(result.output.items).toHaveLength(1);
    expect(result.output.items[0]?.revenuePlanId).toBe('valid');
    expect(result.summary.rejectedCount).toBe(1);
    expect(result.summary.rejectedReasons[0]?.revenuePlanId).toBe('invalid');
    expect(result.summary.rejectedReasons[0]?.reasonCode).toBe('NO_EXECUTION_DOMAIN');
    expect(result.output.items.map((i) => i.revenuePlanId)).not.toContain('invalid');
  });

  it('counts a duplicate in the summary and excludes it as a separate item, merging source refs', () => {
    const result = processRevenue(
      ctx,
      buildInput({
        planningItems: [
          buildItem({
            id: 'first',
            reference: {
              referenceId: 'r1',
              referenceType: 'OPERATIONS_PLAN',
              target: { kind: 'ACCOUNT', key: 'account:acme' },
              executionDomains: [],
              expectedValueScore: 0,
              conversionProbabilityScore: 0,
              retentionRiskScore: 0,
              confidenceScore: 0,
            },
          }),
          buildItem({
            id: 'second',
            reference: {
              referenceId: 'r2',
              referenceType: 'GROWTH_PLAN',
              target: { kind: 'ACCOUNT', key: 'account:acme' },
              executionDomains: [],
              expectedValueScore: 0,
              conversionProbabilityScore: 0,
              retentionRiskScore: 0,
              confidenceScore: 0,
            },
          }),
        ],
      }),
    );
    expect(result.output.items).toHaveLength(1);
    expect(result.output.items[0]?.revenuePlanId).toBe('first');
    expect(result.output.items[0]?.sourceRefs).toEqual([
      { referenceId: 'r1', referenceType: 'OPERATIONS_PLAN' },
      { referenceId: 'r2', referenceType: 'GROWTH_PLAN' },
    ]);
    expect(result.summary.duplicateCount).toBe(1);
    expect(result.summary.duplicateReferences[0]).toEqual({
      revenuePlanId: 'second',
      duplicateOfRevenuePlanId: 'first',
    });
  });

  it('populates scoring fields from scoreRevenuePlanCandidate (worked example)', () => {
    // value 80, conversion 50, risk 40, effort 40, confidence 70 -> impact 31, priority MEDIUM
    const result = processRevenue(ctx, buildInput({ planningItems: [buildItem()] }));
    const item = result.output.items[0];
    expect(item?.revenueImpactScore).toBe(31);
    expect(item?.valueBand).toBe('LOW');
    expect(item?.effortScore).toBe(40);
    expect(item?.effortBand).toBe('MEDIUM');
    expect(item?.confidenceScore).toBe(70);
    expect(item?.priority).toBe('MEDIUM');
  });

  it('copies recommendsProposalDraft to the output item', () => {
    const result = processRevenue(
      ctx,
      buildInput({ planningItems: [buildItem({ recommendsProposalDraft: true })] }),
    );
    expect(result.output.items[0]?.recommendsProposalDraft).toBe(true);
  });

  it('copies monetaryAmount / currency to the output item without affecting scoring', () => {
    const withMoney = processRevenue(
      ctx,
      buildInput({ planningItems: [buildItem({ monetaryAmount: 12000, currency: 'USD' })] }),
    );
    const without = processRevenue(ctx, buildInput({ planningItems: [buildItem()] }));

    expect(withMoney.output.items[0]?.monetaryAmount).toBe(12000);
    expect(withMoney.output.items[0]?.currency).toBe('USD');
    // Scoring fields identical whether or not monetary metadata is present.
    expect(withMoney.output.items[0]?.revenueImpactScore).toBe(
      without.output.items[0]?.revenueImpactScore,
    );
    expect(withMoney.output.items[0]?.priority).toBe(without.output.items[0]?.priority);
  });

  it('satisfies the summary accounting invariant (accepted + rejected + duplicate === derived)', () => {
    const planningItems = [
      buildItem({ id: 'valid' }),
      buildItem({ id: 'invalid', executionDomains: [] }),
      buildItem({ id: 'dup' }), // duplicate of 'valid' (same structural key)
    ];
    const result = processRevenue(ctx, buildInput({ planningItems }));
    const { acceptedCount, rejectedCount, duplicateCount, rejectedReasons, duplicateReferences } =
      result.summary;
    expect(acceptedCount).toBe(result.output.items.length);
    expect(rejectedCount).toBe(rejectedReasons.length);
    expect(duplicateCount).toBe(duplicateReferences.length);
    expect(acceptedCount + rejectedCount + duplicateCount).toBe(planningItems.length);
  });

  it('produces a stable deterministic view across runs (excluding producedAt)', () => {
    const input = buildInput({
      planningItems: [buildItem({ id: 'a' }), buildItem({ id: 'b', planType: 'RENEWAL' })],
    });
    const a = processRevenue(ctx, input);
    const b = processRevenue(ctx, input);
    expect(deterministicView(a)).toEqual(deterministicView(b));
  });
});
