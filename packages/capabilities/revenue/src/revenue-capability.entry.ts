import { Capability } from '@age/capability-kit';
import type { CapabilityRegistryEntry } from '@age/capability-kit';

export const REVENUE_CAPABILITY_ENTRY: CapabilityRegistryEntry = {
  name: Capability.Revenue,
  consumes: ['RevenueInput'],
  assessesContext: ['ScoredBifContext'],
  produces: ['RevenuePlanSet'],
  executionDomains: [],
  dependencies: [],
};
