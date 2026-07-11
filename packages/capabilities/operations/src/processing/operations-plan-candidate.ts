import type { ExecutionDomain } from '@age/capability-kit';
import type {
  OperationsPlanSourceRef,
  OperationsPlanTarget,
  OperationsPlanType,
} from '@age/operations-contracts';

/**
 * OperationsPlanCandidate — an INTERNAL capability type for a derived operations
 * plan before validation, deduplication, scoring, and assembly (ADR-0018).
 *
 * Not exported from the package root; it is an implementation detail of the
 * processing modules. It carries only the fields those modules need. The raw
 * scoring inputs (operationalUrgency/deliveryRisk/estimatedEffort/confidence)
 * live here (not on the public OperationsPlanItem, which carries computed
 * scores). No output envelope.
 */
export interface OperationsPlanCandidate {
  readonly operationsPlanId: string;
  readonly planType: OperationsPlanType;
  readonly target: OperationsPlanTarget;
  readonly executionDomains: readonly ExecutionDomain[];
  readonly operationalUrgency: number;
  readonly deliveryRisk: number;
  readonly estimatedEffort: number;
  readonly confidence: number;
  readonly sourceRefs: readonly OperationsPlanSourceRef[];
}
