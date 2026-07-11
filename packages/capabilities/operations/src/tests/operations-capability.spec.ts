import { describe, expect, it, expectTypeOf } from 'vitest';
import { CapabilityRegistry, Capability, ClientContext } from '@age/capability-kit';
import type { CapabilityResult, ProcessingSummary } from '@age/capability-kit';
import type { OperationsInput } from '@age/operations-contracts';
import { OPERATIONS_CAPABILITY_ENTRY } from '../operations-capability.entry';
import { OperationsCapability } from '../operations-capability';
import type { OperationsPlanItem } from '../operations-plan-item';
import type { OperationsResult } from '../operations-result';
import type {
  OperationsProcessingSummary,
  RejectedOperationsReason,
  DuplicateOperationsReference,
} from '../operations-processing-summary';

function buildInput(overrides: Partial<OperationsInput> = {}): OperationsInput {
  return {
    clientId: 'input-client',
    organizationId: 'input-org',
    planningItems: [],
    generatedAt: '2026-07-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('OperationsCapability entry', () => {
  it('is for Capability.Operations', () => {
    expect(OPERATIONS_CAPABILITY_ENTRY.name).toBe(Capability.Operations);
  });

  it('declares what it consumes and produces', () => {
    expect(OPERATIONS_CAPABILITY_ENTRY.consumes).toContain('OperationsInput');
    expect(OPERATIONS_CAPABILITY_ENTRY.produces).toContain('OperationsPlanSet');
  });

  it('declares no execution-domain triggers and no capability dependencies', () => {
    expect(OPERATIONS_CAPABILITY_ENTRY.executionDomains).toEqual([]);
    expect(OPERATIONS_CAPABILITY_ENTRY.dependencies).toEqual([]);
  });

  it('can be registered in the CapabilityRegistry and resolves to Operations', () => {
    const registry = new CapabilityRegistry();
    expect(() => registry.register(OPERATIONS_CAPABILITY_ENTRY)).not.toThrow();
    expect(registry.resolve(Capability.Operations).name).toBe(Capability.Operations);
  });
});

describe('OperationsResult / OperationsProcessingSummary aliases (ADR-0016)', () => {
  it('OperationsResult is the shared CapabilityResult generic', () => {
    expectTypeOf<OperationsResult>().toEqualTypeOf<
      CapabilityResult<OperationsPlanItem, OperationsProcessingSummary>
    >();
  });

  it('OperationsProcessingSummary is the shared ProcessingSummary generic', () => {
    expectTypeOf<OperationsProcessingSummary>().toEqualTypeOf<
      ProcessingSummary<RejectedOperationsReason, DuplicateOperationsReference>
    >();
  });
});

describe('Operations reason / reference shapes', () => {
  it('RejectedOperationsReason preserves operationsPlanId', () => {
    const reason: RejectedOperationsReason = {
      operationsPlanId: 'ops-plan-1',
      reasonCode: 'MISSING_ID',
      detail: 'no id',
    };
    expect(reason.operationsPlanId).toBe('ops-plan-1');
  });

  it('DuplicateOperationsReference preserves operationsPlanId and duplicateOfOperationsPlanId', () => {
    const ref: DuplicateOperationsReference = {
      operationsPlanId: 'ops-plan-2',
      duplicateOfOperationsPlanId: 'ops-plan-1',
    };
    expect(ref.operationsPlanId).toBe('ops-plan-2');
    expect(ref.duplicateOfOperationsPlanId).toBe('ops-plan-1');
  });
});

describe('OperationsCapability (scaffold-only, T32)', () => {
  it('is instantiable', () => {
    expect(() => new OperationsCapability()).not.toThrow();
  });

  it('run() returns an empty CapabilityOutput<OperationsPlanItem> with a zeroed summary', async () => {
    const capability = new OperationsCapability();
    const ctx = new ClientContext('client-1', 'org-1');
    const result = await capability.run(ctx, buildInput());

    expect(result.output.capability).toBe(Capability.Operations);
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
  });

  it('returns an empty output even when planningItems are present (scaffold does not process input)', async () => {
    const capability = new OperationsCapability();
    const ctx = new ClientContext('client-1', 'org-1');
    const result = await capability.run(
      ctx,
      buildInput({
        planningItems: [
          {
            id: 'ops-plan-1',
            planType: 'PROJECT_PLAN',
            reference: {
              referenceId: 'ref-1',
              referenceType: 'AUTHORITY_PLAN',
              target: { kind: 'PROJECT', key: 'project:acme' },
              executionDomains: [],
              urgencyScore: 70,
              deliveryRiskScore: 55,
              confidenceScore: 65,
            },
            executionDomains: [],
            operationalUrgency: 80,
            deliveryRisk: 50,
            estimatedEffort: 40,
            confidence: 70,
          },
        ],
      }),
    );

    expect(result.output.items).toHaveLength(0);
    expect(result.summary.acceptedCount).toBe(0);
  });

  it('preserves producedAt on the output envelope', async () => {
    const capability = new OperationsCapability();
    const ctx = new ClientContext('client-1', 'org-1');
    const result = await capability.run(ctx, buildInput());
    expect(result.output.producedAt).toBeInstanceOf(Date);
  });

  it('scopes the scaffold output by ClientContext, not by the input (operations rule)', async () => {
    const capability = new OperationsCapability();
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
});
