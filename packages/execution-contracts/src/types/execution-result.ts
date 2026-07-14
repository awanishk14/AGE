import type { ExecutionId } from './execution-id';
import type { ExecutionAuditRecord } from './execution-audit-record';
import type { ExecutionPlan } from './execution-plan';
import type { ExecutionStatus, ExecutionMode, ExecutionRejectionReason } from '../enums';

/**
 * ExecutionResult — the outcome of running a request through the guard and (when
 * allowed) the dry-run executor (ADR-0021 §2).
 *
 * `sideEffectsPerformed` is always `false` in this slice. A blocked/rejected
 * outcome carries the deterministic `rejectionReason` and no plan; a completed
 * dry-run carries the `plan` that was simulated. Every outcome carries an audit
 * record.
 */
export interface ExecutionResult {
  readonly executionId: ExecutionId;
  readonly status: ExecutionStatus;
  readonly mode: ExecutionMode;
  /** Invariant for the whole slice: nothing real ever happens. */
  readonly sideEffectsPerformed: false;
  /** Present only for a completed dry-run. */
  readonly plan?: ExecutionPlan;
  /** Present only when blocked/rejected. */
  readonly rejectionReason?: ExecutionRejectionReason;
  readonly detail?: string;
  readonly audit: ExecutionAuditRecord;
}
