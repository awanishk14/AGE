import { describe, expect, it, beforeEach } from 'vitest';
import { Capability } from '../enums';
import { CapabilityRegistry } from '../registry/capability.registry';
import type { CapabilityRegistryEntry } from '../contracts/capability-registry-entry';

const intelligenceEntry: CapabilityRegistryEntry = {
  name: Capability.Intelligence,
  consumes: ['RIEEvidencePackage'],
  produces: ['ValidatedEvidenceSet'],
  executionDomains: [],
  dependencies: [],
};

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry();
  });

  it('registers and resolves a capability by name', () => {
    registry.register(intelligenceEntry);
    const resolved = registry.resolve(Capability.Intelligence);
    expect(resolved.name).toBe(Capability.Intelligence);
  });

  it('lists all registered capabilities', () => {
    registry.register(intelligenceEntry);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]!.name).toBe(Capability.Intelligence);
  });

  it('throws when resolving an unregistered capability', () => {
    expect(() => registry.resolve(Capability.Growth)).toThrow(
      'Capability Growth is not registered',
    );
  });

  it('throws when registering the same capability twice', () => {
    registry.register(intelligenceEntry);
    expect(() => registry.register(intelligenceEntry)).toThrow(
      'Capability Intelligence is already registered',
    );
  });

  it('treats assessesContext as optional — an entry without it is valid (ADR-0028)', () => {
    expect(intelligenceEntry.assessesContext).toBeUndefined();
    registry.register(intelligenceEntry);
    expect(registry.resolve(Capability.Intelligence).assessesContext).toBeUndefined();
  });

  it('round-trips assessesContext without touching consumes (ADR-0028)', () => {
    const entry: CapabilityRegistryEntry = {
      name: Capability.Revenue,
      consumes: ['RevenueInput'],
      assessesContext: ['ScoredBifContext'],
      produces: ['RevenuePlanSet'],
      executionDomains: [],
      dependencies: [],
    };
    registry.register(entry);
    const resolved = registry.resolve(Capability.Revenue);
    expect(resolved.assessesContext).toEqual(['ScoredBifContext']);
    // The optional field never leaks into the required-input list.
    expect(resolved.consumes).toEqual(['RevenueInput']);
  });
});
