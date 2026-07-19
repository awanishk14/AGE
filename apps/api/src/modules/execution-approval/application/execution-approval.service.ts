import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import {
  createApprovalDecision,
  deriveApprovalStatus,
  type ApprovalDecision,
  type ApprovalDecisionRepository,
} from '@age/execution-approval-workflow';
import type { ExecutionId, ExecutionScope } from '@age/execution-contracts';
import type {
  ExecutionApprovalDecisionDto,
  ExecutionApprovalListResponseDto,
  ExecutionApprovalStatusResponseDto,
  RecordApprovalDecisionRequestDto,
} from './dto';

/**
 * DI token for the `ApprovalDecisionRepository` port. The service depends
 * only on this abstract port (Repository Pattern / DIP) so a future durable
 * adapter can be bound to the same token without changing this service.
 */
export const EXECUTION_APPROVAL_REPOSITORY = Symbol('EXECUTION_APPROVAL_REPOSITORY');

function toApprovalDecisionDto(decision: ApprovalDecision): ExecutionApprovalDecisionDto {
  return {
    id: decision.id,
    executionId: decision.executionId,
    scope: {
      organizationId: decision.scope.organizationId,
      clientId: decision.scope.clientId,
      projectId: decision.scope.projectId,
    },
    outcome: decision.outcome,
    operatorId: decision.operatorId,
    decidedAt: decision.decidedAt.toISOString(),
    reason: decision.reason,
    supersedes: decision.supersedes,
  };
}

function requireScope(organizationId?: string, clientId?: string): ExecutionScope {
  if (!organizationId?.trim() || !clientId?.trim()) {
    throw new BadRequestException(
      'organizationId and clientId are required to record or read an approval decision',
    );
  }
  return { organizationId, clientId };
}

function requireOperatorId(operatorId?: string): string {
  if (!operatorId?.trim()) {
    throw new BadRequestException('operatorId is required to record an approval decision');
  }
  return operatorId;
}

/**
 * ExecutionApprovalService — application service for the Human Approval
 * Workflow API (ADR-0023 Slice D2).
 *
 * This service ONLY records and reads approval decisions via the
 * `@age/execution-approval-workflow` foundation (Slice D1). It never calls
 * the execution guard, the dry-run executor, a real executor, an adapter, a
 * queue/worker/scheduler, or any capability runner — approval and execution
 * remain strictly separate, per ADR-0023.
 *
 * Tenant scoping: this codebase has no finalized auth/tenant mechanism yet
 * (ADR-0021/0022/0023 leave this an open question). Every mutation and read
 * therefore requires explicit `organizationId`/`clientId` fields, and every
 * lookup is delegated to the Slice D1 repository, which enforces scope-key
 * equality and never returns a record belonging to a different tenant. This
 * is a test-safe/demo scoping strategy, not a production auth boundary.
 *
 * Operator attribution: `operatorId` must be explicitly provided on every
 * mutation — there is no default, anonymous, or system-generated approval.
 */
@Injectable()
export class ExecutionApprovalService {
  constructor(
    @Inject(EXECUTION_APPROVAL_REPOSITORY)
    private readonly repository: ApprovalDecisionRepository,
  ) {}

  async approve(
    executionId: ExecutionId,
    request: RecordApprovalDecisionRequestDto,
  ): Promise<ExecutionApprovalDecisionDto> {
    return this.recordDecision(executionId, 'approved_for_dry_run', request);
  }

  async reject(
    executionId: ExecutionId,
    request: RecordApprovalDecisionRequestDto,
  ): Promise<ExecutionApprovalDecisionDto> {
    return this.recordDecision(executionId, 'rejected', request);
  }

  private async recordDecision(
    executionId: ExecutionId,
    outcome: 'approved_for_dry_run' | 'rejected',
    request: RecordApprovalDecisionRequestDto,
  ): Promise<ExecutionApprovalDecisionDto> {
    const scope: ExecutionScope = {
      ...requireScope(request?.organizationId, request?.clientId),
      projectId: request?.projectId,
    };
    const operatorId = requireOperatorId(request?.operatorId);

    const decision = createApprovalDecision({
      executionId,
      scope,
      outcome,
      operatorId,
      decidedAt: new Date(),
      reason: request?.reason,
    });

    const appended = await this.repository.append(decision);
    return toApprovalDecisionDto(appended);
  }

  async getStatus(
    executionId: ExecutionId,
    organizationId?: string,
    clientId?: string,
  ): Promise<ExecutionApprovalStatusResponseDto> {
    const scope = requireScope(organizationId, clientId);
    const history = await this.repository.findByExecutionId(scope, executionId);
    return {
      executionId,
      scope: { organizationId: scope.organizationId, clientId: scope.clientId },
      status: deriveApprovalStatus(history),
      history: history.map(toApprovalDecisionDto),
    };
  }

  async list(
    organizationId?: string,
    clientId?: string,
  ): Promise<ExecutionApprovalListResponseDto> {
    const scope = requireScope(organizationId, clientId);
    const decisions = await this.repository.findByScope(scope);
    return {
      scope: { organizationId: scope.organizationId, clientId: scope.clientId },
      decisions: decisions.map(toApprovalDecisionDto),
    };
  }
}
