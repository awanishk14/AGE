import type { CapabilityOutputItem, ExecutionDomain } from '@age/capability-kit';
import type {
  OperationsEffortBand,
  OperationsPlanPriority,
  OperationsPlanSourceRef,
  OperationsPlanTarget,
  OperationsPlanType,
} from '@age/operations-contracts';

/**
 * OperationsPlanItem — a single accepted, non-duplicate operations plan
 * candidate produced by the Operations Capability (ADR-0018).
 *
 * Score fields (operationalImpactScore, effortScore, effortBand,
 * confidenceScore, priority) are deterministic and computed only from explicit
 * OperationsPlanningInputItem inputs; T32 is scaffold only, so no scoring logic
 * exists yet. `executionDomains` are opaque structural tags carried through —
 * never execution instructions. `sourceRefs` traces the plan back to its
 * originating upstream reference(s), including any structural duplicates merged
 * into it.
 */
export interface OperationsPlanItem extends CapabilityOutputItem {
  readonly operationsPlanId: string;
  readonly planType: OperationsPlanType;
  readonly target: OperationsPlanTarget;
  readonly executionDomains: readonly ExecutionDomain[];
  /** 0–100. Composite operational priority impact (risk × urgency × confidence). */
  readonly operationalImpactScore: number;
  /** 0–100. */
  readonly effortScore: number;
  readonly effortBand: OperationsEffortBand;
  /** 0–100. */
  readonly confidenceScore: number;
  readonly priority: OperationsPlanPriority;
  readonly sourceRefs: readonly OperationsPlanSourceRef[];
}
