import { ExecutionMode } from '../enums';
import type { ExecutionRequest } from '../types/execution-request';
import type { ExecutionResult } from '../types/execution-result';
import { ExecutionGuard } from '../guard/execution-guard';
import { buildAuditRecord } from './audit';
import { DryRunExecutor, type Executor } from './dry-run-executor';

export interface RunExecutionDeps {
  readonly guard: ExecutionGuard;
  readonly executor: Executor;
}

/** Default wiring: the deterministic guard + the dry-run executor. */
export function defaultExecutionDeps(): RunExecutionDeps {
  return { guard: new ExecutionGuard(), executor: new DryRunExecutor() };
}

/**
 * Orchestrate one execution: guard first, executor second.
 *
 * The guard is the sole gate. A blocked/rejected request produces a result
 * directly from the guard decision and **never reaches the executor** — the
 * executor is only invoked for an allowed plan (ADR-0021 §3, §4). No side
 * effects are ever performed, regardless of outcome.
 */
export function runDryRunExecution(
  request: ExecutionRequest,
  deps: RunExecutionDeps = defaultExecutionDeps(),
): ExecutionResult {
  const decision = deps.guard.evaluate(request);

  if (!decision.allowed) {
    return {
      executionId: request.id,
      status: decision.status,
      mode: ExecutionMode.DRY_RUN,
      sideEffectsPerformed: false,
      rejectionReason: decision.reason,
      detail: decision.detail,
      audit: buildAuditRecord(request, decision.status, decision.reason),
    };
  }

  return deps.executor.execute(decision.plan, request);
}
