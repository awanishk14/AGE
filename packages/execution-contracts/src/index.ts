/**
 * @age/execution-contracts — the AGE Execution Foundation (ADR-0021).
 *
 * A pure, in-memory, dependency-light contract boundary for Human-Approved
 * Execution. This slice is strictly dry-run / no-op: it performs NO side
 * effects, calls NO external systems, touches NO persistence/queues, and adds
 * NO API/Web surface. Autonomous Execution remains explicitly out of scope
 * (Docs 09/12/15); real side-effecting adapters are a future, separately-decided
 * slice.
 *
 * Core flow: an accepted capability output → ExecutionIntent (origin preserved)
 * → ExecutionRequest (+ explicit human approval) → ExecutionGuard (deterministic
 * gate) → DryRunExecutor (simulated, sideEffectsPerformed: false) → auditable
 * ExecutionResult.
 */
export { ExecutionStatus, ExecutionMode, ExecutionRejectionReason } from './enums';

export type {
  ExecutionId,
  ExecutionScope,
  ExecutionTarget,
  ExecutionIntent,
  ApprovalContext,
  ExecutionRequest,
  ExecutionPlanStep,
  ExecutionPlan,
  ExecutionResult,
  ExecutionAuditRecord,
} from './types';
export { executionId, TRACEABILITY_CHAIN } from './types';

export { deriveExecutionId, createExecutionRequest } from './factory';

export { ExecutionGuard } from './guard';
export type { GuardDecision } from './guard';

export {
  DryRunExecutor,
  buildAuditRecord,
  runDryRunExecution,
  defaultExecutionDeps,
} from './executor';
export type { Executor, RunExecutionDeps } from './executor';

export { capabilityOutputItemToIntent } from './mapper';
