import type { CapabilityResult } from '@age/capability-kit';
import type { RevenuePlanItem } from './revenue-plan-item';
import type { RevenueProcessingSummary } from './revenue-processing-summary';

/**
 * RevenueResult — the capability-specific result wrapper (ADR-0019). Expressed
 * as the shared `CapabilityResult` generic (ADR-0016): `CapabilityOutput<T>`
 * remains the unmodified generic envelope carrying only accepted, non-duplicate
 * items; `summary` carries the full disposition of everything processed. Revenue
 * never returns a bare CapabilityOutput. Runtime shape is unchanged.
 */
export type RevenueResult = CapabilityResult<RevenuePlanItem, RevenueProcessingSummary>;
