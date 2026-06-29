import type { Capability } from '../enums/capability.enum';
import type { CapabilityRegistryEntry } from '../contracts/capability-registry-entry';

export class CapabilityRegistry {
  private readonly _entries: Map<Capability, CapabilityRegistryEntry> = new Map();

  register(entry: CapabilityRegistryEntry): void {
    if (this._entries.has(entry.name)) {
      throw new Error(`Capability ${entry.name} is already registered`);
    }
    this._entries.set(entry.name, entry);
  }

  resolve(name: Capability): CapabilityRegistryEntry {
    const entry = this._entries.get(name);
    if (!entry) {
      throw new Error(`Capability ${name} is not registered`);
    }
    return entry;
  }

  list(): CapabilityRegistryEntry[] {
    return [...this._entries.values()];
  }
}
