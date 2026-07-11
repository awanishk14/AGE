import type { CapabilityOutputItem, ExecutionDomain } from '@age/capability-kit';
import type {
  RevenueEffortBand,
  RevenuePlanPriority,
  RevenuePlanSourceRef,
  RevenuePlanTarget,
  RevenuePlanType,
  RevenuePlanValueBand,
} from '@age/revenue-contracts';

/**
 * RevenuePlanItem — a single accepted, non-duplicate revenue plan candidate
 * produced by the Revenue Capability (ADR-0019).
 *
 * Score fields (revenueImpactScore, valueBand, effortScore, effortBand,
 * confidenceScore, priority) are deterministic and computed only from explicit
 * RevenuePlanningInputItem inputs; T37 is scaffold only, so no scoring logic
 * exists yet. `executionDomains` are opaque structural tags carried through —
 * never execution instructions. `sourceRefs` traces the plan back to its
 * originating upstream reference(s), including any structural duplicates merged
 * into it. This is a decision object only — never an executable action.
 */
export interface RevenuePlanItem extends CapabilityOutputItem {
  readonly revenuePlanId: string;
  readonly planType: RevenuePlanType;
  readonly target: RevenuePlanTarget;
  readonly executionDomains: readonly ExecutionDomain[];

  /** 0–100. Probability-weighted revenue impact score. */
  readonly revenueImpactScore: number;

  readonly valueBand: RevenuePlanValueBand;

  /** 0–100. */
  readonly effortScore: number;

  readonly effortBand: RevenueEffortBand;

  /** 0–100. */
  readonly confidenceScore: number;

  readonly priority: RevenuePlanPriority;

  readonly sourceRefs: readonly RevenuePlanSourceRef[];

  /**
   * Advisory decision data only. Must never generate proposal content,
   * send a proposal, or invoke document/email/workflow engines.
   */
  readonly recommendsProposalDraft?: boolean;

  /** Raw provenance metadata only; never used in scoring. */
  readonly monetaryAmount?: number;

  /** Raw provenance metadata only; never used in scoring. */
  readonly currency?: string;
}
