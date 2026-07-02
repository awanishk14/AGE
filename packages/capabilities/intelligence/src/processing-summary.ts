/**
 * Reason codes for rejected evidence (ADR-0011). Constrained union, not a
 * free-form string, so rejection reasons stay enumerable and analyzable.
 * The initial set covers the deterministic validation rules planned for T11;
 * extending it is a non-breaking additive change.
 */
export type RejectedEvidenceReasonCode =
  | 'MISSING_ID'
  | 'EMPTY_SOURCE_URL'
  | 'INVALID_CONFIDENCE'
  | 'UNRECOGNIZED_STATE'
  | 'RAW_CONTENT_TOO_SHORT'
  | 'MISSING_TIMESTAMP';

/** Why a single evidence record was rejected during processing. */
export interface RejectedEvidenceReason {
  readonly evidenceId: string;
  readonly reasonCode: RejectedEvidenceReasonCode;
  readonly detail: string;
}

/** A single evidence record identified as a structural duplicate of another. */
export interface DuplicateEvidenceReference {
  readonly evidenceId: string;
  readonly duplicateOfEvidenceId: string;
}

/**
 * ProcessingSummary — disposition of every evidence record processed by the
 * Intelligence Capability (ADR-0011). Rejected and duplicate evidence must
 * never disappear silently: every non-accepted record is traceable here.
 *
 * Invariants (enforced by the processing pipeline, not by this type):
 *  - acceptedCount + rejectedCount + duplicateCount === total evidence processed
 *  - rejectedReasons.length === rejectedCount, each evidenceId appears exactly once
 *  - duplicateReferences.length === duplicateCount, each evidenceId appears exactly once
 *  - contradictionCount is independent: contradiction-flagged records may still
 *    be accepted and counted in acceptedCount unless also rejected/duplicate.
 */
export interface ProcessingSummary {
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly duplicateCount: number;
  readonly contradictionCount: number;
  readonly rejectedReasons: readonly RejectedEvidenceReason[];
  readonly duplicateReferences: readonly DuplicateEvidenceReference[];
}
