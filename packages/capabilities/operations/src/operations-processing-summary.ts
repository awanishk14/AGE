import type { ProcessingSummary } from '@age/capability-kit';

/**
 * Reason codes for rejected operations plan candidates (ADR-0018). Constrained
 * union, never a free-form string. Every code corresponds to a planned
 * deterministic validation rule (T33); no speculative or unused codes. T32
 * declares the type only — no validation is implemented yet.
 */
export type RejectedOperationsReasonCode =
  | 'MISSING_ID'
  | 'EMPTY_PLAN_TARGET'
  | 'NO_EXECUTION_DOMAIN'
  | 'NO_SOURCE_REF'
  | 'INVALID_URGENCY'
  | 'INVALID_RISK'
  | 'INVALID_EFFORT'
  | 'INVALID_CONFIDENCE';

/** Why a single operations plan candidate was rejected during processing. */
export interface RejectedOperationsReason {
  readonly operationsPlanId: string;
  readonly reasonCode: RejectedOperationsReasonCode;
  readonly detail: string;
}

/** A plan candidate identified as a structural duplicate of another. */
export interface DuplicateOperationsReference {
  readonly operationsPlanId: string;
  readonly duplicateOfOperationsPlanId: string;
}

/**
 * OperationsProcessingSummary — disposition of every operations plan candidate
 * processed by the Operations Capability (ADR-0018). Rejected and duplicate
 * candidates must never disappear silently.
 *
 * Invariants (enforced by the T33/T34 pipeline, not by this type):
 *  - acceptedCount + rejectedCount + duplicateCount === total candidates derived
 *  - rejectedReasons.length === rejectedCount, each operationsPlanId appears once
 *  - duplicateReferences.length === duplicateCount, each operationsPlanId appears once
 *
 * Expressed as the shared `ProcessingSummary` generic (ADR-0016) over the
 * Operations-specific reason/reference types; the runtime shape is unchanged.
 */
export type OperationsProcessingSummary = ProcessingSummary<
  RejectedOperationsReason,
  DuplicateOperationsReference
>;
