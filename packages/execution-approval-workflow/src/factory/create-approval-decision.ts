import type { ExecutionId, ExecutionScope } from '@age/execution-contracts';
import { approvalDecisionId, type ApprovalDecisionId } from '../types/approval-decision-id';
import type { ApprovalDecision } from '../types/approval-decision';
import type { ApprovalOutcome } from '../types/approval-status';

/**
 * Derive a stable, deterministic ApprovalDecisionId from the execution being
 * decided, the operator, the outcome, and when it was decided. Pure and
 * order-free, mirroring `deriveExecutionId` in `@age/execution-contracts`.
 */
export function deriveApprovalDecisionId(
  executionId: ExecutionId,
  operatorId: string,
  outcome: ApprovalOutcome,
  decidedAt: Date,
): ApprovalDecisionId {
  const parts = [executionId, operatorId, outcome, decidedAt.toISOString()];
  return approvalDecisionId(`approval:${parts.join('|')}`);
}

/**
 * CreateApprovalDecisionInput — everything a caller must supply explicitly to
 * record a human approval decision. There is no default for `operatorId`,
 * `scope`, `outcome`, or `decidedAt`: this function is the sole, explicit
 * entry point for constructing an `ApprovalDecision`, and it enforces that
 * every one of these fields is present and non-empty before returning a
 * record.
 */
export interface CreateApprovalDecisionInput {
  readonly executionId: ExecutionId;
  readonly scope: ExecutionScope;
  readonly outcome: ApprovalOutcome;
  readonly operatorId: string;
  readonly decidedAt: Date;
  readonly reason?: string;
  readonly supersedes?: ApprovalDecisionId;
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`ApprovalDecision requires a non-empty ${field}`);
  }
}

/**
 * Build an explicit, operator-attributed, tenant-scoped `ApprovalDecision`.
 *
 * Refuses to build a decision with a missing/blank operator identity or an
 * incomplete tenant scope — an anonymous, system-generated, or unscoped
 * approval can never be constructed through this factory (ADR-0023 "Forbidden
 * surfaces"). This function only ever builds a record; it never calls an
 * executor, adapter, or any other side-effecting component.
 */
export function createApprovalDecision(input: CreateApprovalDecisionInput): ApprovalDecision {
  assertNonEmpty(input.operatorId, 'operatorId');
  assertNonEmpty(input.scope.organizationId, 'scope.organizationId');
  assertNonEmpty(input.scope.clientId, 'scope.clientId');

  return {
    id: deriveApprovalDecisionId(
      input.executionId,
      input.operatorId,
      input.outcome,
      input.decidedAt,
    ),
    executionId: input.executionId,
    scope: input.scope,
    outcome: input.outcome,
    operatorId: input.operatorId,
    decidedAt: input.decidedAt,
    reason: input.reason,
    supersedes: input.supersedes,
  };
}
