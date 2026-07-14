import { ExecutionStatus, ExecutionMode } from '../enums';
import type { ExecutionRequest } from '../types/execution-request';
import type { ExecutionPlan } from '../types/execution-plan';
import type { ExecutionResult } from '../types/execution-result';
import { buildAuditRecord } from './audit';

/**
 * Executor — the boundary the guard hands an approved plan to. Only ever
 * invoked for guard-approved requests (ADR-0021 §4).
 */
export interface Executor {
  execute(plan: ExecutionPlan, request: ExecutionRequest): ExecutionResult;
}

/**
 * DryRunExecutor — the only executor in scope. It *simulates* fulfillment and
 * performs no side effects whatsoever: no external API calls, no writes, no
 * messages, no publishing, no state mutation, no queues/workers (ADR-0021 §4).
 *
 * It returns `mode: dry_run`, `sideEffectsPerformed: false`, a completed status,
 * and an auditable record. It is a pure function of its inputs.
 */
export class DryRunExecutor implements Executor {
  execute(plan: ExecutionPlan, request: ExecutionRequest): ExecutionResult {
    return {
      executionId: request.id,
      status: ExecutionStatus.DRY_RUN_COMPLETED,
      mode: ExecutionMode.DRY_RUN,
      sideEffectsPerformed: false,
      plan,
      detail: `Dry-run completed: ${plan.steps.length} step(s) simulated, no side effects performed.`,
      audit: buildAuditRecord(request, ExecutionStatus.DRY_RUN_COMPLETED),
    };
  }
}
