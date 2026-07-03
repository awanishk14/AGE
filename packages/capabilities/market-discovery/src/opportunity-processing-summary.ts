import type { ProcessingSummary } from '@age/capability-kit';

/**
 * Reason codes for rejected opportunity candidates (ADR-0013). Constrained
 * union, never a free-form string. Every code corresponds to a planned
 * deterministic validation rule (T16); no speculative or unused codes.
 */
export type RejectedOpportunityReasonCode =
  | 'MISSING_ID'
  | 'EMPTY_TARGET_KEY'
  | 'NO_EXECUTION_DOMAIN'
  | 'NO_SOURCE_REF'
  | 'INVALID_STRENGTH'
  | 'INVALID_CONFIDENCE'
  | 'INVALID_DEMAND_VOLUME';

/** Why a single opportunity candidate was rejected during processing. */
export interface RejectedOpportunityReason {
  readonly opportunityId: string;
  readonly reasonCode: RejectedOpportunityReasonCode;
  readonly detail: string;
}

/** A candidate identified as a structural duplicate of another. */
export interface DuplicateOpportunityReference {
  readonly opportunityId: string;
  readonly duplicateOfOpportunityId: string;
}

/**
 * OpportunityProcessingSummary — disposition of every opportunity candidate
 * processed by the Market Discovery Capability (ADR-0013). Rejected and
 * duplicate candidates must never disappear silently.
 *
 * Invariants (enforced by the T17 pipeline, not by this type):
 *  - acceptedCount + rejectedCount + duplicateCount === total candidates derived
 *  - rejectedReasons.length === rejectedCount, each opportunityId appears once
 *  - duplicateReferences.length === duplicateCount, each opportunityId appears once
 *
 * Unlike Intelligence (ADR-0011), there is no contradiction concept.
 *
 * Expressed as the shared `ProcessingSummary` generic (ADR-0016) over the
 * Market Discovery-specific reason/reference types; the runtime shape is
 * unchanged.
 */
export type OpportunityProcessingSummary = ProcessingSummary<
  RejectedOpportunityReason,
  DuplicateOpportunityReference
>;
