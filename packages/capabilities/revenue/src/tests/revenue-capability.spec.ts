import { describe, expect, it, expectTypeOf } from 'vitest';
import {
  CapabilityRegistry,
  Capability,
  ClientContext,
  ExecutionDomain,
} from '@age/capability-kit';
import type { CapabilityResult, ProcessingSummary } from '@age/capability-kit';
import type { RevenueInput } from '@age/revenue-contracts';
import { REVENUE_CAPABILITY_ENTRY } from '../revenue-capability.entry';
import { RevenueCapability } from '../revenue-capability';
import { processRevenue } from '../processing/process-revenue';
import type { RevenuePlanItem } from '../revenue-plan-item';
import type { RevenueResult } from '../revenue-result';
import type {
  RevenueProcessingSummary,
  RejectedRevenueReason,
  RejectedRevenueReasonCode,
  DuplicateRevenueReference,
} from '../revenue-processing-summary';

function buildInput(overrides: Partial<RevenueInput> = {}): RevenueInput {
  return {
    clientId: 'input-client',
    organizationId: 'input-org',
    planningItems: [],
    generatedAt: '2026-07-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('RevenueCapability entry', () => {
  it('is for Capability.Revenue', () => {
    expect(REVENUE_CAPABILITY_ENTRY.name).toBe(Capability.Revenue);
  });

  it('declares what it consumes and produces', () => {
    expect(REVENUE_CAPABILITY_ENTRY.consumes).toContain('RevenueInput');
    expect(REVENUE_CAPABILITY_ENTRY.produces).toContain('RevenuePlanSet');
  });

  it('advertises assessed context via assessesContext, never via consumes (ADR-0028)', () => {
    expect(REVENUE_CAPABILITY_ENTRY.assessesContext).toEqual(['ScoredBifContext']);
    // `consumes` is `run`'s required inputs only; ScoredBifContext is optional
    // and never seen by `run`, so it must not appear there.
    expect(REVENUE_CAPABILITY_ENTRY.consumes).not.toContain('ScoredBifContext');
  });

  it('declares no execution-domain triggers and no capability dependencies', () => {
    expect(REVENUE_CAPABILITY_ENTRY.executionDomains).toEqual([]);
    expect(REVENUE_CAPABILITY_ENTRY.dependencies).toEqual([]);
  });

  it('can be registered in the CapabilityRegistry and resolves to Revenue', () => {
    const registry = new CapabilityRegistry();
    expect(() => registry.register(REVENUE_CAPABILITY_ENTRY)).not.toThrow();
    expect(registry.resolve(Capability.Revenue).name).toBe(Capability.Revenue);
  });
});

describe('RevenueResult / RevenueProcessingSummary aliases (ADR-0016)', () => {
  it('RevenueResult is the shared CapabilityResult generic', () => {
    expectTypeOf<RevenueResult>().toEqualTypeOf<
      CapabilityResult<RevenuePlanItem, RevenueProcessingSummary>
    >();
  });

  it('RevenueProcessingSummary is the shared ProcessingSummary generic', () => {
    expectTypeOf<RevenueProcessingSummary>().toEqualTypeOf<
      ProcessingSummary<RejectedRevenueReason, DuplicateRevenueReference>
    >();
  });
});

describe('Revenue reason / reference shapes', () => {
  it('RejectedRevenueReasonCode includes exactly the approved codes', () => {
    const codes: readonly RejectedRevenueReasonCode[] = [
      'MISSING_ID',
      'EMPTY_PLAN_TARGET',
      'NO_EXECUTION_DOMAIN',
      'NO_SOURCE_REF',
      'INVALID_EXPECTED_VALUE',
      'INVALID_CONVERSION_PROBABILITY',
      'INVALID_RETENTION_RISK',
      'INVALID_EFFORT',
      'INVALID_CONFIDENCE',
    ];
    expect(codes).toHaveLength(9);
    expect(new Set(codes).size).toBe(9);
  });

  it('RejectedRevenueReason preserves revenuePlanId', () => {
    const reason: RejectedRevenueReason = {
      revenuePlanId: 'rev-plan-1',
      reasonCode: 'MISSING_ID',
      detail: 'no id',
    };
    expect(reason.revenuePlanId).toBe('rev-plan-1');
  });

  it('DuplicateRevenueReference uses revenuePlanId and duplicateOfRevenuePlanId', () => {
    const ref: DuplicateRevenueReference = {
      revenuePlanId: 'rev-plan-2',
      duplicateOfRevenuePlanId: 'rev-plan-1',
    };
    expect(ref.revenuePlanId).toBe('rev-plan-2');
    expect(ref.duplicateOfRevenuePlanId).toBe('rev-plan-1');
  });
});

describe('RevenuePlanItem shape', () => {
  it('can represent a full accepted plan item (incl. advisory flag and metadata)', () => {
    const item: RevenuePlanItem = {
      id: 'rev-plan-1',
      capability: Capability.Revenue,
      createdAt: new Date('2026-07-12T00:00:00.000Z'),
      revenuePlanId: 'rev-plan-1',
      planType: 'UPSELL',
      target: { kind: 'ACCOUNT', key: 'account:acme' },
      executionDomains: [ExecutionDomain.CRM],
      revenueImpactScore: 62,
      valueBand: 'MEDIUM',
      effortScore: 40,
      effortBand: 'MEDIUM',
      confidenceScore: 70,
      priority: 'MEDIUM',
      sourceRefs: [{ referenceId: 'ops-1', referenceType: 'OPERATIONS_PLAN' }],
      recommendsProposalDraft: true,
      monetaryAmount: 12000,
      currency: 'USD',
    };
    expect(item.revenuePlanId).toBe('rev-plan-1');
    expect(item.planType).toBe('UPSELL');
    expect(item.target).toEqual({ kind: 'ACCOUNT', key: 'account:acme' });
    expect(item.executionDomains).toEqual([ExecutionDomain.CRM]);
    expect(item.revenueImpactScore).toBe(62);
    expect(item.valueBand).toBe('MEDIUM');
    expect(item.effortScore).toBe(40);
    expect(item.effortBand).toBe('MEDIUM');
    expect(item.confidenceScore).toBe(70);
    expect(item.priority).toBe('MEDIUM');
    expect(item.sourceRefs).toEqual([{ referenceId: 'ops-1', referenceType: 'OPERATIONS_PLAN' }]);
    expect(item.recommendsProposalDraft).toBe(true);
    expect(item.monetaryAmount).toBe(12000);
    expect(item.currency).toBe('USD');
  });

  it('uses capability-specific revenuePlanId (no neutral itemId)', () => {
    const item: RevenuePlanItem = {
      id: 'x',
      capability: Capability.Revenue,
      createdAt: new Date('2026-07-12T00:00:00.000Z'),
      revenuePlanId: 'x',
      planType: 'RENEWAL',
      target: { kind: 'CONTRACT', key: 'contract:1' },
      executionDomains: [],
      revenueImpactScore: 0,
      valueBand: 'LOW',
      effortScore: 0,
      effortBand: 'LOW',
      confidenceScore: 0,
      priority: 'LOW',
      sourceRefs: [],
    };
    expect('itemId' in item).toBe(false);
    expect(item.revenuePlanId).toBe('x');
  });
});

describe('RevenueCapability', () => {
  it('is instantiable', () => {
    expect(() => new RevenueCapability()).not.toThrow();
  });

  it('run() delegates to processRevenue (equivalent result, no added behavior)', async () => {
    const capability = new RevenueCapability();
    const ctx = new ClientContext('client-1', 'org-1');
    const input = buildInput({
      planningItems: [
        {
          id: 'rev-plan-1',
          planType: 'UPSELL',
          reference: {
            referenceId: 'ops-1',
            referenceType: 'OPERATIONS_PLAN',
            target: { kind: 'ACCOUNT', key: 'account:acme' },
            executionDomains: [ExecutionDomain.Reporting],
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
        },
      ],
    });

    const viaRun = await capability.run(ctx, input);
    const viaProcess = processRevenue(ctx, input);

    // Same items and summary; producedAt is wall-clock so excluded from comparison.
    expect(viaRun.output.items).toEqual(viaProcess.output.items);
    expect(viaRun.summary).toEqual(viaProcess.summary);
    expect(viaRun.output.clientId).toBe(viaProcess.output.clientId);
    expect(viaRun.output.executionDomains).toEqual(viaProcess.output.executionDomains);
    expect(viaRun.output.items).toHaveLength(1);
  });

  it('run() returns an empty CapabilityOutput<RevenuePlanItem> with a zeroed summary', async () => {
    const capability = new RevenueCapability();
    const ctx = new ClientContext('client-1', 'org-1');
    const result = await capability.run(ctx, buildInput());

    expect(result.output.capability).toBe(Capability.Revenue);
    expect(result.output.items).toBeInstanceOf(Array);
    expect(result.output.items).toHaveLength(0);
    expect(result.output.executionDomains).toHaveLength(0);

    expect(result.summary).toEqual({
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      rejectedReasons: [],
      duplicateReferences: [],
    });
    expect(result.summary.rejectedReasons).toEqual([]);
    expect(result.summary.duplicateReferences).toEqual([]);
  });

  it('scopes the scaffold output by ClientContext, not by the input (revenue rule)', async () => {
    const capability = new RevenueCapability();
    const ctx = new ClientContext('authoritative-client', 'authoritative-org');
    const result = await capability.run(
      ctx,
      buildInput({ clientId: 'input-client', organizationId: 'input-org' }),
    );

    expect(result.output.clientId).toBe('authoritative-client');
    expect(result.output.organizationId).toBe('authoritative-org');
    expect(result.output.clientId).not.toBe('input-client');
    expect(result.output.organizationId).not.toBe('input-org');
  });

  it('preserves producedAt on the output envelope', async () => {
    const capability = new RevenueCapability();
    const ctx = new ClientContext('client-1', 'org-1');
    const result = await capability.run(ctx, buildInput());
    expect(result.output.producedAt).toBeInstanceOf(Date);
  });
});
