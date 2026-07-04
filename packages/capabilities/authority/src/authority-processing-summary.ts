import type { ProcessingSummary } from '@age/capability-kit';

/**
 * Reason codes for rejected authority plan candidates (ADR-0017). Constrained
 * union, never a free-form string. Every code corresponds to a planned
 * deterministic validation rule (T29); no speculative or unused codes.
 */
export type RejectedAuthorityReasonCode =
  | 'MISSING_ID'
  | 'EMPTY_PLAN_TARGET'
  | 'NO_EXECUTION_DOMAIN'
  | 'NO_SOURCE_REF'
  | 'INVALID_IMPACT'
  | 'INVALID_EFFORT'
  | 'INVALID_CONFIDENCE';

/** Why a single authority plan candidate was rejected during processing. */
export interface RejectedAuthorityReason {
  readonly authorityPlanId: string;
  readonly reasonCode: RejectedAuthorityReasonCode;
  readonly detail: string;
}

/** A plan candidate identified as a structural duplicate of another. */
export interface DuplicateAuthorityReference {
  readonly authorityPlanId: string;
  readonly duplicateOfAuthorityPlanId: string;
}

/**
 * AuthorityProcessingSummary — disposition of every authority plan candidate
 * processed by the Authority Capability (ADR-0017). Rejected and duplicate
 * candidates must never disappear silently.
 *
 * Invariants (enforced by the T29 pipeline, not by this type):
 *  - acceptedCount + rejectedCount + duplicateCount === total candidates derived
 *  - rejectedReasons.length === rejectedCount, each authorityPlanId appears once
 *  - duplicateReferences.length === duplicateCount, each authorityPlanId appears once
 *
 * Expressed as the shared `ProcessingSummary` generic (ADR-0016) over the
 * Authority-specific reason/reference types; the runtime shape is unchanged.
 */
export type AuthorityProcessingSummary = ProcessingSummary<
  RejectedAuthorityReason,
  DuplicateAuthorityReference
>;
