import { ExecutionStatus, ExecutionMode, ExecutionRejectionReason } from '../enums';
import type { ExecutionRequest } from '../types/execution-request';
import { TRACEABILITY_CHAIN, type ExecutionAuditRecord } from '../types/execution-audit-record';

/**
 * Build a pure, deterministic audit record for one execution outcome
 * (ADR-0021 §6). `decidedAt` is derived from the request inputs — approval time
 * when approved, otherwise the origin item's createdAt — never a wall-clock
 * read, so the record is deterministic for the same input.
 */
export function buildAuditRecord(
  request: ExecutionRequest,
  status: ExecutionStatus,
  rejectionReason?: ExecutionRejectionReason,
): ExecutionAuditRecord {
  const decidedAt = request.approval.approved
    ? request.approval.approvedAt
    : request.intent.sourceCreatedAt;

  return {
    executionId: request.id,
    capability: request.intent.capability,
    sourceItemId: request.intent.sourceItemId,
    executionDomain: request.target.executionDomain,
    scope: request.target.scope,
    status,
    mode: ExecutionMode.DRY_RUN,
    sideEffectsPerformed: false,
    ...(rejectionReason ? { rejectionReason } : {}),
    decidedAt,
    traceability: TRACEABILITY_CHAIN,
  };
}
