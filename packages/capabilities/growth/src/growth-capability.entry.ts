import { Capability } from '@age/capability-kit';
import type { CapabilityRegistryEntry } from '@age/capability-kit';

export const GROWTH_CAPABILITY_ENTRY: CapabilityRegistryEntry = {
  name: Capability.Growth,
  consumes: ['GrowthInput'],
  produces: ['GrowthPlanSet'],
  executionDomains: [],
  dependencies: [],
};
