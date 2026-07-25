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
  /**
   * The input contracts this capability's `run` method requires (ADR-0008).
   * A mandatory precondition of execution — never an optional or side-channel
   * input. `ScoredBifContext` is deliberately NOT listed here (ADR-0028):
   * `run` never receives it; see `assessesContext`.
   */
  readonly consumes: ReadonlyArray<string>;
  /**
   * Contracts this capability reads ONLY through a non-gating readiness
   * assessment (ADR-0027), never through `run` (ADR-0028). Optional and
   * additive: `undefined` means the capability assesses no external context —
   * the correct default for a non-adopter. Advertising context assessment here
   * asserts no precondition on `run` and grants no runtime consumption path.
   */
  readonly assessesContext?: ReadonlyArray<string>;
  readonly produces: ReadonlyArray<string>;
  readonly executionDomains: ReadonlyArray<ExecutionDomain>;
  readonly dependencies: ReadonlyArray<Capability>;
}
