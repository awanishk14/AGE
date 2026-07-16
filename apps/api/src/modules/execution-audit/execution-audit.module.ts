import { Module } from '@nestjs/common';
import { InMemoryExecutionAuditRepository } from '@age/execution-audit-persistence';
import { ExecutionAuditController } from './presentation/execution-audit.controller';
import {
  ExecutionAuditService,
  EXECUTION_AUDIT_REPOSITORY,
} from './application/execution-audit.service';

/**
 * ExecutionAuditModule — read-only bounded context exposing dry-run
 * execution audit history (ADR-0022 Slice B).
 *
 * Reads only. `ExecutionAuditService` depends on the abstract
 * `ExecutionAuditPersistenceRepository` port (via the `EXECUTION_AUDIT_REPOSITORY`
 * token); this module binds it to the in-memory reference repository from
 * `@age/execution-audit-persistence` (Slice A). A future durable adapter can be
 * bound to the same token without touching the service. No database/Prisma
 * wiring, no queue, no external integrations, no approval or execute route.
 */
@Module({
  controllers: [ExecutionAuditController],
  providers: [
    ExecutionAuditService,
    { provide: EXECUTION_AUDIT_REPOSITORY, useClass: InMemoryExecutionAuditRepository },
  ],
  exports: [ExecutionAuditService],
})
export class ExecutionAuditModule {}
