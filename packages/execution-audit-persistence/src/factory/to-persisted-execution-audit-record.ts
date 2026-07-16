import type { ExecutionRequest, ExecutionResult } from '@age/execution-contracts';
import { TRACEABILITY_CHAIN } from '@age/execution-contracts';
import type { ExecutionAuditPersistedRecord } from '../types/execution-audit-persisted-record';

/**
 * Build the durable persistence snapshot for one Execution Foundation
 * outcome. Pure and deterministic: `createdAt` is caller-supplied (input-
 * derived), never wall-clock, so the same request + result always yields an
 * identical persisted record (mirrors the determinism guarantee already
 * proven for `runDryRunExecution` in `@age/execution-contracts`).
 *
 * `sideEffectsPerformed` is asserted `false` at the boundary — this factory
 * refuses to build a record for any result that is not dry-run/no-op, so a
 * real (side-effecting) result can never be persisted through this slice.
 */
export function toPersistedExecutionAuditRecord(
  request: ExecutionRequest,
  result: ExecutionResult,
  createdAt: Date,
): ExecutionAuditPersistedRecord {
  if (result.sideEffectsPerformed !== false) {
    throw new Error(
      'ExecutionAuditPersistedRecord requires a dry-run result (sideEffectsPerformed: false)',
    );
  }
  if (result.executionId !== request.id) {
    throw new Error('ExecutionResult.executionId must match ExecutionRequest.id');
  }

  return {
    id: result.executionId,
    executionId: result.executionId,
    scope: request.target.scope,
    status: result.status,
    sideEffectsPerformed: false,
    traceability: TRACEABILITY_CHAIN,
    requestSnapshot: request,
    planSnapshot: result.plan,
    resultSnapshot: result,
    auditSnapshot: result.audit,
    createdAt,
    decidedAt: result.audit.decidedAt,
  };
}
