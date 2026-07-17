import type { ExecutionId, ExecutionScope } from '@age/execution-contracts';
import type { ApprovalDecisionRepository } from '../interfaces/approval-decision-repository';
import type { ApprovalDecision } from '../types/approval-decision';
import type { ApprovalDecisionId } from '../types/approval-decision-id';

function scopeKey(scope: ExecutionScope): string {
  return `${scope.organizationId}::${scope.clientId}`;
}

function assertScoped(scope: ExecutionScope): void {
  if (scope.organizationId.trim().length === 0 || scope.clientId.trim().length === 0) {
    throw new Error('ApprovalDecision requires a non-empty organizationId and clientId');
  }
}

/**
 * InMemoryApprovalDecisionRepository — a reference, in-memory implementation
 * of `ApprovalDecisionRepository` (ADR-0023 Slice D1).
 *
 * This is NOT a production persistence adapter: it holds no connection, does
 * no I/O, and is process-local. It exists to (a) prove the port's
 * append-only/immutable/tenant-scoped/operator-attributed contract is
 * enforceable, and (b) act as a drop-in fake for tests of any future caller
 * (e.g. a future approval-decision API service) without requiring a real
 * database. A durable (e.g. Prisma-backed) adapter is a later, separate,
 * explicitly-authorized slice.
 */
export class InMemoryApprovalDecisionRepository implements ApprovalDecisionRepository {
  private readonly decisionsById = new Map<ApprovalDecisionId, ApprovalDecision>();
  private readonly idsByExecutionId = new Map<ExecutionId, ApprovalDecisionId[]>();
  private readonly idsByScope = new Map<string, ApprovalDecisionId[]>();

  async append(decision: ApprovalDecision): Promise<ApprovalDecision> {
    assertScoped(decision.scope);

    if (decision.operatorId.trim().length === 0) {
      throw new Error('ApprovalDecision requires a non-empty operatorId');
    }
    if (this.decisionsById.has(decision.id)) {
      throw new Error(
        `ApprovalDecision ${decision.id} already exists — decisions are append-only and cannot be overwritten`,
      );
    }

    const frozen = Object.freeze({ ...decision });
    this.decisionsById.set(decision.id, frozen);

    const byExecution = this.idsByExecutionId.get(decision.executionId) ?? [];
    this.idsByExecutionId.set(decision.executionId, [...byExecution, decision.id]);

    const key = scopeKey(decision.scope);
    const byScope = this.idsByScope.get(key) ?? [];
    this.idsByScope.set(key, [...byScope, decision.id]);

    return frozen;
  }

  async findByExecutionId(
    scope: ExecutionScope,
    executionId: ExecutionId,
  ): Promise<readonly ApprovalDecision[]> {
    assertScoped(scope);
    const ids = this.idsByExecutionId.get(executionId) ?? [];
    return ids
      .map((id) => this.decisionsById.get(id))
      .filter((d): d is ApprovalDecision => d !== undefined)
      .filter((d) => scopeKey(d.scope) === scopeKey(scope));
  }

  async findByScope(scope: ExecutionScope): Promise<readonly ApprovalDecision[]> {
    assertScoped(scope);
    const ids = this.idsByScope.get(scopeKey(scope)) ?? [];
    return ids
      .map((id) => this.decisionsById.get(id))
      .filter((d): d is ApprovalDecision => d !== undefined);
  }
}
