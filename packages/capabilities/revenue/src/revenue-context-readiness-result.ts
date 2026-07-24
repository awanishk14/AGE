import type { CapabilityOutputItem, CapabilityResult } from '@age/capability-kit';
import type { RevenueContextReadinessSummary } from './revenue-context-readiness-summary';

/**
 * RevenueContextReadinessResult — the result of assessing whether a
 * `ScoredBifContext` carries enough context for revenue work (ADR-0027,
 * Decision 1).
 *
 * Expressed as the SHARED `CapabilityResult` generic (ADR-0016), exactly like
 * `RevenueResult`. No separate or parallel result type is introduced: the
 * readiness state rides on the shared `CapabilityOutput` envelope
 * (`result.output.sufficiency`, ADR-0026 Decision 3) and the timestamp is the
 * caller-supplied `producedAt` (Decision 2).
 *
 * The item type is the BASE `CapabilityOutputItem`, and `output.items` is ALWAYS
 * empty. That is structural, not incidental: ADR-0027 Decision 1 forbids a
 * readiness assessment from deriving, ranking, naming or hinting at any revenue
 * plan, so there is no item shape it could legitimately emit. Everything this
 * assessment has to say lives in `summary` and `output.sufficiency`.
 */
export type RevenueContextReadinessResult = CapabilityResult<
  CapabilityOutputItem,
  RevenueContextReadinessSummary
>;
