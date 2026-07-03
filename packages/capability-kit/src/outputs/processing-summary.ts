import type { CapabilityOutputItem } from './capability-output-item';
import type { CapabilityOutput } from './capability-output';

/**
 * ProcessingSummary — the shared disposition summary for a capability that
 * validates and structurally deduplicates its candidates (ADR-0016).
 *
 * Generic over the capability-specific rejected-reason and duplicate-reference
 * TYPES (not over a reason-code string), so each capability keeps its own
 * public reason/reference shapes — including their id fields
 * (evidenceId / opportunityId / planId) and reason-code unions — unchanged.
 *
 * Invariants (enforced by each capability's pipeline, not by this type):
 *  - acceptedCount + rejectedCount + duplicateCount === total candidates processed
 *  - rejectedReasons.length === rejectedCount, each id appears exactly once
 *  - duplicateReferences.length === duplicateCount, each id appears exactly once
 *
 * Capability-specific summary fields (e.g. Intelligence's contradictionCount)
 * are added by intersecting this type in the owning capability, never here.
 */
export interface ProcessingSummary<TRejectedReason, TDuplicateReference> {
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly duplicateCount: number;
  readonly rejectedReasons: readonly TRejectedReason[];
  readonly duplicateReferences: readonly TDuplicateReference[];
}

/**
 * CapabilityResult — the shared result wrapper (ADR-0016). Pairs the unmodified
 * generic `CapabilityOutput<TItem>` envelope (accepted, non-duplicate items
 * only) with a capability-specific `TSummary` carrying full disposition.
 */
export interface CapabilityResult<TItem extends CapabilityOutputItem, TSummary> {
  readonly output: CapabilityOutput<TItem>;
  readonly summary: TSummary;
}
