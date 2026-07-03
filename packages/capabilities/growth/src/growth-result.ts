import type { CapabilityResult } from '@age/capability-kit';
import type { GrowthPlanItem } from './growth-plan-item';
import type { GrowthProcessingSummary } from './growth-processing-summary';

/**
 * GrowthResult — the capability-specific result wrapper (ADR-0015, adopted and
 * final). Expressed as the shared `CapabilityResult` generic (ADR-0016):
 * `CapabilityOutput<T>` remains the unmodified generic envelope carrying only
 * accepted, non-duplicate items; `summary` carries the full disposition of
 * everything processed. Growth never returns a bare CapabilityOutput. Runtime
 * shape is unchanged.
 */
export type GrowthResult = CapabilityResult<GrowthPlanItem, GrowthProcessingSummary>;
