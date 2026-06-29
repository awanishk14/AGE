import type { Capability } from '../enums/capability.enum';
import type { ExecutionDomain } from '../enums/execution-domain.enum';

/**
 * CapabilityRegistryEntry — the metadata declaration every capability provides.
 *
 * Capabilities are never hardcoded across the platform; consumers resolve
 * metadata through the CapabilityRegistry (ADR-0008).
 */
export interface CapabilityRegistryEntry {
  readonly name: Capability;
  readonly consumes: ReadonlyArray<string>;
  readonly produces: ReadonlyArray<string>;
  readonly executionDomains: ReadonlyArray<ExecutionDomain>;
  readonly dependencies: ReadonlyArray<Capability>;
}
