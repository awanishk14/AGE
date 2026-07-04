import type { CapabilityOutputItem, ExecutionDomain } from '@age/capability-kit';
import type {
  AuthorityEffortBand,
  AuthorityPlanPriority,
  AuthorityPlanSourceRef,
  AuthorityPlanTarget,
  AuthorityPlanType,
} from '@age/authority-contracts';

/**
 * AuthorityPlanItem — a single accepted, non-duplicate authority plan candidate
 * produced by the Authority Capability.
 *
 * Score fields (impactScore, effortScore, effortBand, confidenceScore, priority)
 * are deterministic and computed only from explicit AuthorityPlanningInputItem
 * inputs (ADR-0017); T27 is scaffold only, so no scoring logic exists yet.
 * `executionDomains` are opaque structural tags carried through — never
 * execution instructions. `sourceRefs` traces the plan back to its originating
 * upstream reference(s), including any structural duplicates merged into it.
 */
export interface AuthorityPlanItem extends CapabilityOutputItem {
  readonly authorityPlanId: string;
  readonly planType: AuthorityPlanType;
  readonly target: AuthorityPlanTarget;
  readonly executionDomains: readonly ExecutionDomain[];
  /** 0–100. */
  readonly impactScore: number;
  /** 0–100. */
  readonly effortScore: number;
  readonly effortBand: AuthorityEffortBand;
  /** 0–100. */
  readonly confidenceScore: number;
  readonly priority: AuthorityPlanPriority;
  readonly sourceRefs: readonly AuthorityPlanSourceRef[];
}
