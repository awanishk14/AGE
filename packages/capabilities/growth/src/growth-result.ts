import type { CapabilityOutput } from '@age/capability-kit';
import type { GrowthPlanItem } from './growth-plan-item';
import type { GrowthProcessingSummary } from './growth-processing-summary';

/**
 * GrowthResult — the capability-specific result wrapper (ADR-0015, adopted and
 * final). `CapabilityOutput<T>` remains the unmodified generic envelope and
 * carries only accepted, non-duplicate items; `summary` carries the full
 * disposition of everything processed. Growth never returns a bare
 * CapabilityOutput.
 */
export interface GrowthResult {
  readonly output: CapabilityOutput<GrowthPlanItem>;
  readonly summary: GrowthProcessingSummary;
}
