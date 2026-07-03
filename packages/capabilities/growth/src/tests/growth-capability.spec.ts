import { describe, expect, it } from 'vitest';
import { CapabilityRegistry, Capability, ClientContext } from '@age/capability-kit';
import type { GrowthInput } from '@age/growth-contracts';
import { GROWTH_CAPABILITY_ENTRY } from '../growth-capability.entry';
import { GrowthCapability } from '../growth-capability';

function buildInput(overrides: Partial<GrowthInput> = {}): GrowthInput {
  return {
    clientId: 'input-client',
    organizationId: 'input-org',
    planningItems: [],
    generatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('GrowthCapability entry', () => {
  it('has the correct capability name', () => {
    expect(GROWTH_CAPABILITY_ENTRY.name).toBe(Capability.Growth);
  });

  it('declares what it consumes and produces', () => {
    expect(GROWTH_CAPABILITY_ENTRY.consumes).toContain('GrowthInput');
    expect(GROWTH_CAPABILITY_ENTRY.produces).toContain('GrowthPlanSet');
  });

  it('can be registered in the CapabilityRegistry without error', () => {
    const registry = new CapabilityRegistry();
    expect(() => registry.register(GROWTH_CAPABILITY_ENTRY)).not.toThrow();
    expect(registry.resolve(Capability.Growth).name).toBe(Capability.Growth);
  });
});

describe('GrowthCapability', () => {
  it('is instantiable', () => {
    expect(() => new GrowthCapability()).not.toThrow();
  });

  it('run() returns a GrowthResult with an empty output and zeroed summary', async () => {
    const capability = new GrowthCapability();
    const ctx = new ClientContext('client-1', 'org-1');
    const result = await capability.run(ctx, buildInput());

    expect(result.output.capability).toBe(Capability.Growth);
    expect(result.output.items).toBeInstanceOf(Array);
    expect(result.output.items).toHaveLength(0);

    expect(result.summary).toEqual({
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      rejectedReasons: [],
      duplicateReferences: [],
    });
  });

  it('scopes the output by ClientContext, not by the input (authority rule)', async () => {
    const capability = new GrowthCapability();
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
