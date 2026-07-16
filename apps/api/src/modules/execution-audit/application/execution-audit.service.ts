import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  ExecutionAuditPersistedRecord,
  ExecutionAuditPersistenceRepository,
} from '@age/execution-audit-persistence';
import type { ExecutionId, ExecutionScope } from '@age/execution-contracts';
import type { ExecutionAuditListResponseDto, ExecutionAuditRecordDto } from './dto';

/**
 * DI token for the `ExecutionAuditPersistenceRepository` port. The service
 * depends only on this abstract port (Repository Pattern / DIP) so a future
 * durable adapter (e.g. Prisma-backed, a later slice) can be bound to the
 * same token without changing this service.
 */
export const EXECUTION_AUDIT_REPOSITORY = Symbol('EXECUTION_AUDIT_REPOSITORY');

/** Project one persisted record into the read-only API DTO shape. */
function toExecutionAuditRecordDto(record: ExecutionAuditPersistedRecord): ExecutionAuditRecordDto {
  return {
    executionId: record.executionId,
    scope: record.scope,
    status: record.status,
    mode: record.resultSnapshot.mode,
    sideEffectsPerformed: record.sideEffectsPerformed,
    traceability: record.traceability,
    dryRunResultSnapshot: record.resultSnapshot,
    createdAt: record.createdAt.toISOString(),
    decidedAt: record.decidedAt.toISOString(),
    executedAt: record.executedAt?.toISOString(),
  };
}

function requireScope(organizationId?: string, clientId?: string): ExecutionScope {
  if (!organizationId?.trim() || !clientId?.trim()) {
    throw new BadRequestException(
      'organizationId and clientId query parameters are required to read execution audit history',
    );
  }
  return { organizationId, clientId };
}

/**
 * ExecutionAuditService — application service for the read-only dry-run
 * execution audit history API (ADR-0022 Slice B).
 *
 * Backed by `InMemoryExecutionAuditRepository` from `@age/execution-audit-persistence`
 * (Slice A). This is a demo/test-safe, process-local, in-memory data source: no
 * database, queue, or external system is wired up in this slice. Because no
 * production write path exists yet, this service will typically return an
 * empty list — that is expected and safe.
 *
 * Tenant scoping: this codebase has no finalized auth/tenant mechanism yet
 * (ADR-0021/0022 leave this an open question). Every read therefore requires
 * explicit `organizationId`/`clientId` query parameters, and every lookup is
 * delegated to the Slice A repository, which enforces scope-key equality and
 * never returns a record belonging to a different tenant. This is a
 * test-safe/demo scoping strategy, not a production auth boundary.
 */
@Injectable()
export class ExecutionAuditService {
  constructor(
    @Inject(EXECUTION_AUDIT_REPOSITORY)
    private readonly repository: ExecutionAuditPersistenceRepository,
  ) {}

  async list(organizationId?: string, clientId?: string): Promise<ExecutionAuditListResponseDto> {
    const scope = requireScope(organizationId, clientId);
    const records = await this.repository.findByScope(scope);
    return {
      scope: { organizationId: scope.organizationId, clientId: scope.clientId },
      records: records.map(toExecutionAuditRecordDto),
    };
  }

  async findByExecutionId(
    executionId: ExecutionId,
    organizationId?: string,
    clientId?: string,
  ): Promise<ExecutionAuditRecordDto> {
    const scope = requireScope(organizationId, clientId);
    const record = await this.repository.findByExecutionId(scope, executionId);
    if (!record) {
      throw new NotFoundException(
        `No dry-run execution audit record ${executionId} found in the given scope`,
      );
    }
    return toExecutionAuditRecordDto(record);
  }
}
