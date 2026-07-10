import { describe, expect, it, expectTypeOf } from 'vitest';
import {
  CapabilityRegistry,
  Capability,
  ClientContext,
  ExecutionDomain,
} from '@age/capability-kit';
import type { CapabilityResult, ProcessingSummary } from '@age/capability-kit';
import type { AuthorityInput } from '@age/authority-contracts';
import { AUTHORITY_CAPABILITY_ENTRY } from '../authority-capability.entry';
import { AuthorityCapability } from '../authority-capability';
import { processAuthority } from '../processing/process-authority';
import type { AuthorityPlanItem } from '../authority-plan-item';
import type { AuthorityResult } from '../authority-result';
import type {
  AuthorityProcessingSummary,
  RejectedAuthorityReason,
  DuplicateAuthorityReference,
} from '../authority-processing-summary';

function buildInput(overrides: Partial<AuthorityInput> = {}): AuthorityInput {
  return {
    clientId: 'input-client',
    organizationId: 'input-org',
    planningItems: [],
    generatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('AuthorityCapability entry', () => {
  it('is for Capability.Authority', () => {
    expect(AUTHORITY_CAPABILITY_ENTRY.name).toBe(Capability.Authority);
  });

  it('declares what it consumes and produces', () => {
    expect(AUTHORITY_CAPABILITY_ENTRY.consumes).toContain('AuthorityInput');
    expect(AUTHORITY_CAPABILITY_ENTRY.produces).toContain('AuthorityPlanSet');
  });

  it('can be registered in the CapabilityRegistry and resolves to Authority', () => {
    const registry = new CapabilityRegistry();
    expect(() => registry.register(AUTHORITY_CAPABILITY_ENTRY)).not.toThrow();
    expect(registry.resolve(Capability.Authority).name).toBe(Capability.Authority);
  });
});

describe('AuthorityResult / AuthorityProcessingSummary aliases (ADR-0016)', () => {
  it('AuthorityResult is the shared CapabilityResult generic', () => {
    expectTypeOf<AuthorityResult>().toEqualTypeOf<
      CapabilityResult<AuthorityPlanItem, AuthorityProcessingSummary>
    >();
  });

  it('AuthorityProcessingSummary is the shared ProcessingSummary generic', () => {
    expectTypeOf<AuthorityProcessingSummary>().toEqualTypeOf<
      ProcessingSummary<RejectedAuthorityReason, DuplicateAuthorityReference>
    >();
  });
});

describe('Authority reason / reference shapes', () => {
  it('RejectedAuthorityReason preserves authorityPlanId', () => {
    const reason: RejectedAuthorityReason = {
      authorityPlanId: 'plan-1',
      reasonCode: 'MISSING_ID',
      detail: 'no id',
    };
    expect(reason.authorityPlanId).toBe('plan-1');
  });

  it('DuplicateAuthorityReference preserves authorityPlanId and duplicateOfAuthorityPlanId', () => {
    const ref: DuplicateAuthorityReference = {
      authorityPlanId: 'plan-2',
      duplicateOfAuthorityPlanId: 'plan-1',
    };
    expect(ref.authorityPlanId).toBe('plan-2');
    expect(ref.duplicateOfAuthorityPlanId).toBe('plan-1');
  });
});

describe('AuthorityCapability', () => {
  it('is instantiable', () => {
    expect(() => new AuthorityCapability()).not.toThrow();
  });

  it('run() returns an empty CapabilityOutput<AuthorityPlanItem> with a zeroed summary for empty input', async () => {
    const capability = new AuthorityCapability();
    const ctx = new ClientContext('client-1', 'org-1');
    const result = await capability.run(ctx, buildInput());

    expect(result.output.capability).toBe(Capability.Authority);
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

  it('run() delegates to processAuthority (equivalent result, no added behavior)', async () => {
    const capability = new AuthorityCapability();
    const ctx = new ClientContext('client-1', 'org-1');
    const input = buildInput({
      planningItems: [
        {
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
        },
      ],
    });

    const viaRun = await capability.run(ctx, input);
    const viaProcess = processAuthority(ctx, input);

    // Same items and summary; producedAt is wall-clock so excluded from comparison.
    expect(viaRun.output.items).toEqual(viaProcess.output.items);
    expect(viaRun.summary).toEqual(viaProcess.summary);
    expect(viaRun.output.clientId).toBe(viaProcess.output.clientId);
    expect(viaRun.output.executionDomains).toEqual(viaProcess.output.executionDomains);
    expect(viaRun.output.items).toHaveLength(1);
  });

  it('scopes the scaffold output by ClientContext, not by the input (authority rule)', async () => {
    const capability = new AuthorityCapability();
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
