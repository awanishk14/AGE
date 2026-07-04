import { Capability } from '@age/capability-kit';
import type { CapabilityRegistryEntry } from '@age/capability-kit';

export const AUTHORITY_CAPABILITY_ENTRY: CapabilityRegistryEntry = {
  name: Capability.Authority,
  consumes: ['AuthorityInput'],
  produces: ['AuthorityPlanSet'],
  executionDomains: [],
  dependencies: [],
};
