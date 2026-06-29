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
});
