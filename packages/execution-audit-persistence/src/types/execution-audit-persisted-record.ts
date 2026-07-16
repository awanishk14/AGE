import type {
  ExecutionId,
  ExecutionScope,
  ExecutionRequest,
  ExecutionPlan,
  ExecutionResult,
  ExecutionAuditRecord,
  ExecutionStatus,
  TRACEABILITY_CHAIN,
} from '@age/execution-contracts';

/**
 * ExecutionAuditPersistedRecord — the durable, append-only persistence
 * envelope around one dry-run Execution Foundation outcome (ADR-0022 Slice A).
 *
 * This is a frozen snapshot: `requestSnapshot`, `planSnapshot`, `resultSnapshot`,
 * and `auditSnapshot` are the exact `@age/execution-contracts` values produced
 * for this execution, stored verbatim (JSON-serializable) rather than
 * re-derived. The record is identified by `executionId`, which is itself
 * deterministic (ADR-0021), so persisting is idempotent by value — the same
 * approved request always yields the same record.
 *
 * `sideEffectsPerformed` is pinned to the literal `false` at the type level:
 * this slice persists dry-run/no-op outcomes only. A real (side-effecting)
 * executor is out of scope and requires a separate, future ADR (ADR-0022
 * Slice E).
 */
export interface ExecutionAuditPersistedRecord {
  readonly id: ExecutionId;
  readonly executionId: ExecutionId;
  readonly scope: ExecutionScope;
  readonly status: ExecutionStatus;
  readonly sideEffectsPerformed: false;
  readonly traceability: typeof TRACEABILITY_CHAIN;
  readonly requestSnapshot: ExecutionRequest;
  readonly planSnapshot?: ExecutionPlan;
  readonly resultSnapshot: ExecutionResult;
  readonly auditSnapshot: ExecutionAuditRecord;
  readonly createdAt: Date;
  readonly decidedAt: Date;
  readonly executedAt?: Date;
}
