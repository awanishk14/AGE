import { Capability } from '@age/capability-kit';
import type { CapabilityRegistryEntry } from '@age/capability-kit';

export const INTELLIGENCE_CAPABILITY_ENTRY: CapabilityRegistryEntry = {
  name: Capability.Intelligence,
  consumes: ['RIEEvidencePackage'],
  assessesContext: ['ScoredBifContext'],
  produces: ['ValidatedEvidenceSet'],
  executionDomains: [],
  dependencies: [],
};
