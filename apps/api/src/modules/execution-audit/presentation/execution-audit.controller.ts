import { Controller, Get, Param, Query } from '@nestjs/common';
import { executionId } from '@age/execution-contracts';
import { ExecutionAuditService } from '../application/execution-audit.service';
import type { ExecutionAuditListResponseDto, ExecutionAuditRecordDto } from '../application/dto';

/**
 * ExecutionAuditController — presentation boundary for the read-only dry-run
 * execution audit history API (ADR-0022 Slice B).
 *
 * Read-only: no mutation verbs and no execute or approval route of any kind.
 * Every route requires explicit `organizationId`/`clientId` scope — see
 * `ExecutionAuditService` for the tenant-scoping rationale.
 */
@Controller('execution-audit')
export class ExecutionAuditController {
  constructor(private readonly executionAuditService: ExecutionAuditService) {}

  /** GET /execution-audit?organizationId=&clientId= — list dry-run audit records in scope. */
  @Get()
  list(
    @Query('organizationId') organizationId?: string,
    @Query('clientId') clientId?: string,
  ): Promise<ExecutionAuditListResponseDto> {
    return this.executionAuditService.list(organizationId, clientId);
  }

  /** GET /execution-audit/:executionId?organizationId=&clientId= — read one record, scope-checked. */
  @Get(':executionId')
  findByExecutionId(
    @Param('executionId') executionIdParam: string,
    @Query('organizationId') organizationId?: string,
    @Query('clientId') clientId?: string,
  ): Promise<ExecutionAuditRecordDto> {
    return this.executionAuditService.findByExecutionId(
      executionId(executionIdParam),
      organizationId,
      clientId,
    );
  }
}
