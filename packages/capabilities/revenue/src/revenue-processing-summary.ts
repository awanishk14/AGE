import type { ProcessingSummary } from '@age/capability-kit';

/**
 * Reason codes for rejected revenue plan candidates (ADR-0019). Constrained
 * union, never a free-form string. Every code corresponds to a planned
 * deterministic validation rule (later task); no speculative or unused codes.
 * T37 declares the type only — no validation is implemented yet.
 */
export type RejectedRevenueReasonCode =
  | 'MISSING_ID'
  | 'EMPTY_PLAN_TARGET'
  | 'NO_EXECUTION_DOMAIN'
  | 'NO_SOURCE_REF'
  | 'INVALID_EXPECTED_VALUE'
  | 'INVALID_CONVERSION_PROBABILITY'
  | 'INVALID_RETENTION_RISK'
  | 'INVALID_EFFORT'
  | 'INVALID_CONFIDENCE';

/** Why a single revenue plan candidate was rejected during processing. */
export interface RejectedRevenueReason {
  readonly revenuePlanId: string;
  readonly reasonCode: RejectedRevenueReasonCode;
  readonly detail: string;
}

/** A plan candidate identified as a structural duplicate of another. */
export interface DuplicateRevenueReference {
  readonly revenuePlanId: string;
  readonly duplicateOfRevenuePlanId: string;
}

/**
 * RevenueProcessingSummary — disposition of every revenue plan candidate
 * processed by the Revenue Capability (ADR-0019). Rejected and duplicate
 * candidates must never disappear silently.
 *
 * Invariants (enforced by the later pipeline, not by this type):
 *  - acceptedCount + rejectedCount + duplicateCount === total candidates derived
 *  - rejectedReasons.length === rejectedCount, each revenuePlanId appears once
 *  - duplicateReferences.length === duplicateCount, each revenuePlanId appears once
 *
 * Expressed as the shared `ProcessingSummary` generic (ADR-0016) over the
 * Revenue-specific reason/reference types; the runtime shape is unchanged.
 */
export type RevenueProcessingSummary = ProcessingSummary<
  RejectedRevenueReason,
  DuplicateRevenueReference
>;
