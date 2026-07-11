import { describe, expect, it } from 'vitest';
import { Capability, ClientContext, ExecutionDomain } from '@age/capability-kit';
import type { OperationsInput, OperationsPlanningInputItem } from '@age/operations-contracts';
import { processOperations } from '../../processing/process-operations';
import type { OperationsResult } from '../../operations-result';

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

function buildInput(overrides: Partial<OperationsInput> = {}): OperationsInput {
  return {
    clientId: 'input-client',
    organizationId: 'input-org',
    planningItems: [],
    generatedAt: '2026-07-11T00:00:00.000Z',
    ...overrides,
  };
}

/** Deterministic view of a result, excluding the wall-clock producedAt. */
function deterministicView(result: OperationsResult) {
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

describe('processOperations', () => {
  it('returns empty output and a zeroed summary for empty input', () => {
    const result = processOperations(ctx, buildInput());
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

  it('produces one accepted output item for a valid planning item', () => {
    const result = processOperations(ctx, buildInput({ planningItems: [buildItem()] }));
    expect(result.output.items).toHaveLength(1);
    const item = result.output.items[0];
    expect(item?.operationsPlanId).toBe('ops-plan-1');
    expect(item?.id).toBe('ops-plan-1');
    expect(item?.capability).toBe(Capability.Operations);
    expect(item?.planType).toBe('PROJECT_PLAN');
    expect(item?.target).toEqual({ kind: 'PROJECT', key: 'project:acme' });
    expect(item?.sourceRefs).toEqual([{ referenceId: 'ref-1', referenceType: 'AUTHORITY_PLAN' }]);
    expect(result.summary.acceptedCount).toBe(1);
  });

  it('scopes output by ClientContext, not by OperationsInput', () => {
    const authoritative = new ClientContext('authoritative-client', 'authoritative-org');
    const result = processOperations(
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
    const generatedAt = '2026-07-11T12:34:56.000Z';
    const result = processOperations(
      ctx,
      buildInput({ generatedAt, planningItems: [buildItem()] }),
    );
    expect(result.output.items[0]?.createdAt).toEqual(new Date(generatedAt));
    expect(result.output.items[0]?.createdAt.toISOString()).toBe(generatedAt);
  });

  it('keeps CapabilityOutput.producedAt present (wall-clock, not a deterministic assertion)', () => {
    const result = processOperations(ctx, buildInput({ planningItems: [buildItem()] }));
    expect(result.output.producedAt).toBeInstanceOf(Date);
  });

  it('item execution domains come from item.executionDomains, not reference.executionDomains', () => {
    const result = processOperations(ctx, buildInput({ planningItems: [buildItem()] }));
    expect(result.output.items[0]?.executionDomains).toEqual([ExecutionDomain.Reporting]);
    expect(result.output.items[0]?.executionDomains).not.toContain(ExecutionDomain.CRM);
  });

  it('envelope execution domains are the sorted, deduplicated union of accepted item domains', () => {
    const result = processOperations(
      ctx,
      buildInput({
        planningItems: [
          buildItem({
            id: 'a',
            planType: 'PROJECT_PLAN',
            executionDomains: [ExecutionDomain.Reporting, ExecutionDomain.CRM],
          }),
          buildItem({
            id: 'b',
            planType: 'QA_PLAN',
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
    // Deduplicated: CRM appears once.
    expect(result.output.executionDomains.filter((d) => d === ExecutionDomain.CRM)).toHaveLength(1);
  });

  it('counts and excludes rejected candidates from output items', () => {
    const result = processOperations(
      ctx,
      buildInput({
        planningItems: [
          buildItem({ id: 'valid' }),
          buildItem({ id: 'invalid', executionDomains: [] }), // NO_EXECUTION_DOMAIN
        ],
      }),
    );
    expect(result.output.items).toHaveLength(1);
    expect(result.output.items[0]?.operationsPlanId).toBe('valid');
    expect(result.summary.rejectedCount).toBe(1);
    expect(result.summary.rejectedReasons[0]?.operationsPlanId).toBe('invalid');
    expect(result.summary.rejectedReasons[0]?.reasonCode).toBe('NO_EXECUTION_DOMAIN');
    expect(result.output.items.map((i) => i.operationsPlanId)).not.toContain('invalid');
  });

  it('counts duplicates and excludes them as separate output items, merging source refs', () => {
    const result = processOperations(
      ctx,
      buildInput({
        planningItems: [
          buildItem({
            id: 'first',
            reference: {
              referenceId: 'r1',
              referenceType: 'A',
              target: { kind: 'PROJECT', key: 'project:acme' },
              executionDomains: [],
              urgencyScore: 0,
              deliveryRiskScore: 0,
              confidenceScore: 0,
            },
          }),
          buildItem({
            id: 'second',
            reference: {
              referenceId: 'r2',
              referenceType: 'B',
              target: { kind: 'PROJECT', key: 'project:acme' },
              executionDomains: [],
              urgencyScore: 0,
              deliveryRiskScore: 0,
              confidenceScore: 0,
            },
          }),
        ],
      }),
    );
    expect(result.output.items).toHaveLength(1);
    expect(result.output.items[0]?.operationsPlanId).toBe('first');
    // Merged source refs from the duplicate flow into the accepted original item.
    expect(result.output.items[0]?.sourceRefs).toEqual([
      { referenceId: 'r1', referenceType: 'A' },
      { referenceId: 'r2', referenceType: 'B' },
    ]);
    expect(result.summary.duplicateCount).toBe(1);
    expect(result.summary.duplicateReferences[0]).toEqual({
      operationsPlanId: 'second',
      duplicateOfOperationsPlanId: 'first',
    });
  });

  it('emits scoring fields on the output item matching the approved formula', () => {
    // urgency 80, risk 50, effort 40, confidence 70 -> impact 67, priority MEDIUM
    const result = processOperations(ctx, buildInput({ planningItems: [buildItem()] }));
    const item = result.output.items[0];
    expect(item?.operationalImpactScore).toBe(67);
    expect(item?.effortScore).toBe(40);
    expect(item?.effortBand).toBe('MEDIUM');
    expect(item?.confidenceScore).toBe(70);
    expect(item?.priority).toBe('MEDIUM');
  });

  it('satisfies the summary accounting invariant (accepted + rejected + duplicate === derived)', () => {
    const planningItems = [
      buildItem({ id: 'valid' }),
      buildItem({ id: 'invalid', executionDomains: [] }),
      buildItem({ id: 'dup' }), // duplicate of 'valid' (same key)
    ];
    const result = processOperations(ctx, buildInput({ planningItems }));
    const { acceptedCount, rejectedCount, duplicateCount, rejectedReasons, duplicateReferences } =
      result.summary;
    expect(acceptedCount).toBe(result.output.items.length);
    expect(rejectedCount).toBe(rejectedReasons.length);
    expect(duplicateCount).toBe(duplicateReferences.length);
    expect(acceptedCount + rejectedCount + duplicateCount).toBe(planningItems.length);
  });

  it('produces a stable deterministic view across runs (excluding producedAt)', () => {
    const input = buildInput({
      planningItems: [buildItem({ id: 'a' }), buildItem({ id: 'b', planType: 'QA_PLAN' })],
    });
    const a = processOperations(ctx, input);
    const b = processOperations(ctx, input);
    expect(deterministicView(a)).toEqual(deterministicView(b));
  });
});
