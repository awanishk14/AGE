import type { ProcessingSummary } from '@age/capability-kit';

/**
 * Reason codes for rejected growth plan candidates (ADR-0015). Constrained
 * union, never a free-form string. Every code corresponds to a planned
 * deterministic validation rule (T20); no speculative or unused codes.
 */
export type RejectedGrowthReasonCode =
  | 'MISSING_ID'
  | 'EMPTY_PLAN_TARGET'
  | 'NO_EXECUTION_DOMAIN'
  | 'NO_SOURCE_REF'
  | 'INVALID_IMPACT'
  | 'INVALID_EFFORT'
  | 'INVALID_CONFIDENCE';

/** Why a single growth plan candidate was rejected during processing. */
export interface RejectedGrowthReason {
  readonly planId: string;
  readonly reasonCode: RejectedGrowthReasonCode;
  readonly detail: string;
}

/** A plan candidate identified as a structural duplicate of another. */
export interface DuplicateGrowthReference {
  readonly planId: string;
  readonly duplicateOfPlanId: string;
}

/**
 * GrowthProcessingSummary — disposition of every growth plan candidate processed
 * by the Growth Capability (ADR-0015). Rejected and duplicate candidates must
 * never disappear silently.
 *
 * Invariants (enforced by the T21 pipeline, not by this type):
 *  - acceptedCount + rejectedCount + duplicateCount === total candidates derived
 *  - rejectedReasons.length === rejectedCount, each planId appears once
 *  - duplicateReferences.length === duplicateCount, each planId appears once
 *
 * There is no contradiction concept (ADR-0015).
 *
 * Expressed as the shared `ProcessingSummary` generic (ADR-0016) over the
 * Growth-specific reason/reference types; the runtime shape is unchanged.
 */
export type GrowthProcessingSummary = ProcessingSummary<
  RejectedGrowthReason,
  DuplicateGrowthReference
>;
