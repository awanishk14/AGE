/**
 * ExecutionStatus — the lifecycle of one execution (ADR-0021 §2).
 *
 * The only successful terminal state in this slice is DRY_RUN_COMPLETED — no
 * real side effect is ever performed. BLOCKED and REJECTED are deterministic
 * guard outcomes that never reach the executor.
 */
export enum ExecutionStatus {
  /** Awaiting explicit human approval; cannot proceed. */
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  /** Explicitly approved by a human; eligible for dry-run fulfillment. */
  APPROVED = 'APPROVED',
  /** Dry-run fulfillment completed — no side effects performed. */
  DRY_RUN_COMPLETED = 'DRY_RUN_COMPLETED',
  /** Rejected by the guard for an invalid target or invalid/missing origin. */
  REJECTED = 'REJECTED',
  /** Blocked by the guard because it is not approved. */
  BLOCKED = 'BLOCKED',
}
