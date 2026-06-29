import { describe, expect, it } from 'vitest';
import { CapabilityRegistry, Capability } from '@age/capability-kit';
import { INTELLIGENCE_CAPABILITY_ENTRY } from '../intelligence-capability.entry';
import { IntelligenceCapability } from '../intelligence-capability';

describe('IntelligenceCapability entry', () => {
  it('has the correct capability name', () => {
    expect(INTELLIGENCE_CAPABILITY_ENTRY.name).toBe(Capability.Intelligence);
  });

  it('declares what it consumes and produces', () => {
    expect(INTELLIGENCE_CAPABILITY_ENTRY.consumes).toContain('RIEEvidencePackage');
    expect(INTELLIGENCE_CAPABILITY_ENTRY.produces).toContain('ValidatedEvidenceSet');
  });

  it('can be registered in the CapabilityRegistry without error', () => {
    const registry = new CapabilityRegistry();
    expect(() => registry.register(INTELLIGENCE_CAPABILITY_ENTRY)).not.toThrow();
    expect(registry.resolve(Capability.Intelligence).name).toBe(Capability.Intelligence);
  });
});

describe('IntelligenceCapability', () => {
  it('is instantiable', () => {
    expect(() => new IntelligenceCapability()).not.toThrow();
  });

  it('run() returns a CapabilityOutput for the given context', async () => {
    const capability = new IntelligenceCapability();
    const { ClientContext } = await import('@age/capability-kit');
    const ctx = new ClientContext('client-1', 'org-1');
    const output = await capability.run(ctx);
    expect(output.capability).toBe(Capability.Intelligence);
    expect(output.clientId).toBe('client-1');
    expect(output.items).toBeInstanceOf(Array);
  });
});
