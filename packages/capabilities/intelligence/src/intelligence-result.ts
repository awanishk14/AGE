import type { CapabilityResult } from '@age/capability-kit';
import type { IntelligenceOutputItem } from './intelligence-output-item';
import type { IntelligenceProcessingSummary } from './processing-summary';

/**
 * IntelligenceResult — the capability-specific result wrapper for the
 * Intelligence Capability (ADR-0011). Expressed as the shared `CapabilityResult`
 * generic (ADR-0016): `CapabilityOutput<T>` remains the unmodified generic
 * envelope carrying only accepted, non-duplicate items; `summary` carries the
 * full disposition of everything processed. Runtime shape is unchanged.
 */
export type IntelligenceResult = CapabilityResult<
  IntelligenceOutputItem,
  IntelligenceProcessingSummary
>;
