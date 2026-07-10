import type { CapabilityResult } from '@age/capability-kit';
import type { AuthorityPlanItem } from './authority-plan-item';
import type { AuthorityProcessingSummary } from './authority-processing-summary';

/**
 * AuthorityResult — the capability-specific result wrapper (ADR-0017). Expressed
 * as the shared `CapabilityResult` generic (ADR-0016): `CapabilityOutput<T>`
 * remains the unmodified generic envelope carrying only accepted, non-duplicate
 * items; `summary` carries the full disposition of everything processed.
 * Authority never returns a bare CapabilityOutput. Runtime shape is unchanged.
 */
export type AuthorityResult = CapabilityResult<AuthorityPlanItem, AuthorityProcessingSummary>;
