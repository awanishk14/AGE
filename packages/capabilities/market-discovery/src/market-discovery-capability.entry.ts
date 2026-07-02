import { Capability } from '@age/capability-kit';
import type { CapabilityRegistryEntry } from '@age/capability-kit';

export const MARKET_DISCOVERY_CAPABILITY_ENTRY: CapabilityRegistryEntry = {
  name: Capability.MarketDiscovery,
  consumes: ['MarketDiscoveryInput'],
  produces: ['MarketOpportunitySet'],
  executionDomains: [],
  dependencies: [],
};
