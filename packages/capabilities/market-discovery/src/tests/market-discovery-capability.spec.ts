import { describe, expect, it } from 'vitest';
import { CapabilityRegistry, Capability, ClientContext } from '@age/capability-kit';
import type { MarketDiscoveryInput } from '@age/market-discovery-contracts';
import { MARKET_DISCOVERY_CAPABILITY_ENTRY } from '../market-discovery-capability.entry';
import { MarketDiscoveryCapability } from '../market-discovery-capability';

function buildInput(overrides: Partial<MarketDiscoveryInput> = {}): MarketDiscoveryInput {
  return {
    clientId: 'input-client',
    organizationId: 'input-org',
    signals: [],
    generatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('MarketDiscoveryCapability entry', () => {
  it('has the correct capability name', () => {
    expect(MARKET_DISCOVERY_CAPABILITY_ENTRY.name).toBe(Capability.MarketDiscovery);
  });

  it('declares what it consumes and produces', () => {
    expect(MARKET_DISCOVERY_CAPABILITY_ENTRY.consumes).toContain('MarketDiscoveryInput');
    expect(MARKET_DISCOVERY_CAPABILITY_ENTRY.produces).toContain('MarketOpportunitySet');
  });

  it('advertises assessed context via assessesContext, never via consumes (ADR-0028)', () => {
    expect(MARKET_DISCOVERY_CAPABILITY_ENTRY.assessesContext).toEqual(['ScoredBifContext']);
    // `consumes` is `run`'s required inputs only; ScoredBifContext is optional
    // and never seen by `run`, so it must not appear there.
    expect(MARKET_DISCOVERY_CAPABILITY_ENTRY.consumes).not.toContain('ScoredBifContext');
  });

  it('can be registered in the CapabilityRegistry without error', () => {
    const registry = new CapabilityRegistry();
    expect(() => registry.register(MARKET_DISCOVERY_CAPABILITY_ENTRY)).not.toThrow();
    expect(registry.resolve(Capability.MarketDiscovery).name).toBe(Capability.MarketDiscovery);
  });
});

describe('MarketDiscoveryCapability', () => {
  it('is instantiable', () => {
    expect(() => new MarketDiscoveryCapability()).not.toThrow();
  });

  it('run() returns a MarketDiscoveryResult with an empty output and zeroed summary', async () => {
    const capability = new MarketDiscoveryCapability();
    const ctx = new ClientContext('client-1', 'org-1');
    const result = await capability.run(ctx, buildInput());

    expect(result.output.capability).toBe(Capability.MarketDiscovery);
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
    const capability = new MarketDiscoveryCapability();
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
