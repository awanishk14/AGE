import { executionId, type ExecutionId } from '../types/execution-id';
import type { ExecutionIntent } from '../types/execution-intent';
import type { ExecutionTarget } from '../types/execution-target';
import type { ApprovalContext, ExecutionRequest } from '../types/execution-request';

/**
 * Derive a stable, deterministic ExecutionId from an intent + target.
 *
 * Pure and order-free: the same origin fulfilled into the same domain/scope
 * always yields the same id. This gives deterministic idempotency at the
 * value level without any dedup store (dedup is deferred to a future ADR).
 */
export function deriveExecutionId(intent: ExecutionIntent, target: ExecutionTarget): ExecutionId {
  const parts = [
    intent.capability,
    intent.sourceItemId,
    target.executionDomain,
    target.scope.organizationId,
    target.scope.clientId,
    target.scope.projectId ?? '-',
  ];
  return executionId(`exec:${parts.join('|')}`);
}

/**
 * Build an ExecutionRequest with a deterministically derived id. Approval must
 * be supplied explicitly by the caller (never inferred here).
 */
export function createExecutionRequest(
  intent: ExecutionIntent,
  target: ExecutionTarget,
  approval: ApprovalContext,
): ExecutionRequest {
  return {
    id: deriveExecutionId(intent, target),
    intent,
    target,
    approval,
  };
}
