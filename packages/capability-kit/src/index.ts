export { Capability, ExecutionDomain } from './enums';
export type { CapabilityOutputItem } from './outputs';
export { CapabilityOutput } from './outputs';
export type { ProcessingSummary, CapabilityResult } from './outputs';
// Capability sufficiency / readiness (ADR-0026, Decision 3). Shared vocabulary
// only — no threshold policy, no context source, no clock.
export {
  CapabilitySufficiencyState,
  CAPABILITY_SUFFICIENCY_STATES,
  createCapabilitySufficiency,
} from './outputs';
export type {
  CapabilitySufficiency,
  CapabilitySufficiencyProps,
  CapabilitySufficiencyReasons,
} from './outputs';
export { CapabilityError } from './errors';
export { ClientContext } from './context';
export type { CapabilityRegistryEntry } from './contracts';
export { CapabilityRegistry } from './registry';
