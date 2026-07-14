import { ExecutionDomain } from '@age/capability-kit';
import { ExecutionStatus, ExecutionRejectionReason, ExecutionMode } from '../enums';
import type { ExecutionRequest } from '../types/execution-request';
import type { ExecutionPlan } from '../types/execution-plan';

/**
 * The deterministic outcome of guarding a request. Either the request is
 * allowed (with the fulfillment plan derived from it) or it is stopped with a
 * status + surfaced reason. A stopped request never reaches the executor.
 */
export type GuardDecision =
  | { readonly allowed: true; readonly plan: ExecutionPlan }
  | {
      readonly allowed: false;
      readonly status: ExecutionStatus.BLOCKED | ExecutionStatus.REJECTED;
      readonly reason: ExecutionRejectionReason;
      readonly detail: string;
    };

const KNOWN_DOMAINS: ReadonlySet<string> = new Set(Object.values(ExecutionDomain));

/**
 * ExecutionGuard — enforces Human-Approved Execution deterministically
 * (ADR-0021 §3). It is the only gate to the executor.
 *
 * Checks, in a fixed order so the outcome is deterministic:
 *   1. Origin present   — invalid/missing origin → REJECTED (MISSING_ORIGIN)
 *   2. Target valid      — bad domain/scope       → REJECTED (INVALID_*)
 *   3. Approved          — not approved           → BLOCKED  (UNAPPROVED)
 *
 * Approval is read from explicit input; it is never inferred.
 */
export class ExecutionGuard {
  evaluate(request: ExecutionRequest): GuardDecision {
    const originError = this.checkOrigin(request);
    if (originError) return originError;

    const targetError = this.checkTarget(request);
    if (targetError) return targetError;

    const approvalError = this.checkApproval(request);
    if (approvalError) return approvalError;

    return { allowed: true, plan: this.buildPlan(request) };
  }

  private checkOrigin(request: ExecutionRequest): GuardDecision | undefined {
    const { intent } = request;
    const hasOrigin =
      typeof intent.sourceItemId === 'string' &&
      intent.sourceItemId.trim().length > 0 &&
      typeof intent.capability === 'string' &&
      intent.capability.length > 0;
    if (hasOrigin) return undefined;
    return {
      allowed: false,
      status: ExecutionStatus.REJECTED,
      reason: ExecutionRejectionReason.MISSING_ORIGIN,
      detail: 'Execution intent has no accepted capability-output origin.',
    };
  }

  private checkTarget(request: ExecutionRequest): GuardDecision | undefined {
    const { target } = request;
    if (!KNOWN_DOMAINS.has(target.executionDomain)) {
      return {
        allowed: false,
        status: ExecutionStatus.REJECTED,
        reason: ExecutionRejectionReason.INVALID_EXECUTION_DOMAIN,
        detail: `Unknown execution domain "${String(target.executionDomain)}".`,
      };
    }
    const scope = target.scope;
    const validScope =
      typeof scope?.organizationId === 'string' &&
      scope.organizationId.trim().length > 0 &&
      typeof scope.clientId === 'string' &&
      scope.clientId.trim().length > 0;
    if (!validScope) {
      return {
        allowed: false,
        status: ExecutionStatus.REJECTED,
        reason: ExecutionRejectionReason.INVALID_SCOPE,
        detail: 'Execution target scope must have an organization and a client.',
      };
    }
    return undefined;
  }

  private checkApproval(request: ExecutionRequest): GuardDecision | undefined {
    const approval = request.approval;
    const approved =
      approval.approved === true &&
      typeof approval.approvedBy === 'string' &&
      approval.approvedBy.trim().length > 0;
    if (approved) return undefined;
    return {
      allowed: false,
      status: ExecutionStatus.BLOCKED,
      reason: ExecutionRejectionReason.UNAPPROVED,
      detail: 'Execution requires explicit human approval before it can proceed.',
    };
  }

  /** Derive the descriptive dry-run plan for an allowed request (fulfillment only). */
  private buildPlan(request: ExecutionRequest): ExecutionPlan {
    return {
      executionId: request.id,
      mode: ExecutionMode.DRY_RUN,
      steps: [
        {
          order: 1,
          executionDomain: request.target.executionDomain,
          description: `Dry-run: would fulfill "${request.intent.summary}" in ${request.target.executionDomain}.`,
        },
      ],
    };
  }
}
