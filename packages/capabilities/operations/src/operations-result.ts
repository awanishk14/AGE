import type { CapabilityResult } from '@age/capability-kit';
import type { OperationsPlanItem } from './operations-plan-item';
import type { OperationsProcessingSummary } from './operations-processing-summary';

/**
 * OperationsResult — the capability-specific result wrapper (ADR-0018).
 * Expressed as the shared `CapabilityResult` generic (ADR-0016):
 * `CapabilityOutput<T>` remains the unmodified generic envelope carrying only
 * accepted, non-duplicate items; `summary` carries the full disposition of
 * everything processed. Operations never returns a bare CapabilityOutput.
 * Runtime shape is unchanged.
 */
export type OperationsResult = CapabilityResult<OperationsPlanItem, OperationsProcessingSummary>;
