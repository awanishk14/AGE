import { Module } from '@nestjs/common';
import { InMemoryExecutionAuditRepository } from '@age/execution-audit-persistence';
import { ExecutionAuditController } from './presentation/execution-audit.controller';
import { ExecutionAuditService } from './application/execution-audit.service';

/**
 * ExecutionAuditModule — read-only bounded context exposing dry-run
 * execution audit history (ADR-0022 Slice B).
 *
 * Reads only, from the in-memory `@age/execution-audit-persistence` reference
 * repository (Slice A). No database/Prisma wiring, no queue, no external
 * integrations, no approval or execute route.
 */
@Module({
  controllers: [ExecutionAuditController],
  providers: [ExecutionAuditService, InMemoryExecutionAuditRepository],
  exports: [ExecutionAuditService],
})
export class ExecutionAuditModule {}
