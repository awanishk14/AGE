import type { CapabilityOutputItem, ExecutionDomain } from '@age/capability-kit';
import type {
  GrowthEffortBand,
  GrowthPlanPriority,
  GrowthPlanSourceRef,
  GrowthPlanTarget,
  GrowthPlanType,
} from '@age/growth-contracts';

/**
 * GrowthPlanItem — a single accepted, non-duplicate growth plan candidate
 * produced by the Growth Capability.
 *
 * Score fields (impactScore, effortScore, effortBand, confidenceScore, priority)
 * are deterministic and computed only from explicit GrowthPlanningInputItem
 * inputs (ADR-0015); T19 is scaffold only, so no scoring logic exists yet.
 * `executionDomains` are opaque structural tags carried through — never
 * execution instructions. `sourceRefs` traces the plan back to its originating
 * opportunity reference(s), including any structural duplicates merged into it.
 */
export interface GrowthPlanItem extends CapabilityOutputItem {
  readonly planId: string;
  readonly planType: GrowthPlanType;
  readonly target: GrowthPlanTarget;
  readonly executionDomains: readonly ExecutionDomain[];
  /** 0–100. */
  readonly impactScore: number;
  /** 0–100. */
  readonly effortScore: number;
  readonly effortBand: GrowthEffortBand;
  /** 0–100. */
  readonly confidenceScore: number;
  readonly priority: GrowthPlanPriority;
  readonly sourceRefs: readonly GrowthPlanSourceRef[];
}
