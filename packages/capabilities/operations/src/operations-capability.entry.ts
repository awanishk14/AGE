import { Capability } from '@age/capability-kit';
import type { CapabilityRegistryEntry } from '@age/capability-kit';

export const OPERATIONS_CAPABILITY_ENTRY: CapabilityRegistryEntry = {
  name: Capability.Operations,
  consumes: ['OperationsInput'],
  produces: ['OperationsPlanSet'],
  executionDomains: [],
  dependencies: [],
};
