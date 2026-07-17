import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { executionId } from '@age/execution-contracts';
import { ExecutionApprovalService } from '../application/execution-approval.service';
import type {
  ExecutionApprovalDecisionDto,
  ExecutionApprovalListResponseDto,
  ExecutionApprovalStatusResponseDto,
  RecordApprovalDecisionRequestDto,
} from '../application/dto';

/**
 * ExecutionApprovalController — presentation boundary for the Human Approval
 * Workflow API (ADR-0023 Slice D2).
 *
 * Every mutation route (`approve`, `reject`) only records an append-only
 * approval decision via `ExecutionApprovalService` — it never triggers
 * execution of any kind. There is no execute route, no approval-to-execution
 * automation, and no GET-based mutation.
 */
@Controller('execution-approval')
export class ExecutionApprovalController {
  constructor(private readonly executionApprovalService: ExecutionApprovalService) {}

  /** POST /execution-approval/:executionId/approve — record an approved_for_dry_run decision. */
  @Post(':executionId/approve')
  approve(
    @Param('executionId') executionIdParam: string,
    @Body() request: RecordApprovalDecisionRequestDto,
  ): Promise<ExecutionApprovalDecisionDto> {
    return this.executionApprovalService.approve(executionId(executionIdParam), request);
  }

  /** POST /execution-approval/:executionId/reject — record a rejected decision. */
  @Post(':executionId/reject')
  reject(
    @Param('executionId') executionIdParam: string,
    @Body() request: RecordApprovalDecisionRequestDto,
  ): Promise<ExecutionApprovalDecisionDto> {
    return this.executionApprovalService.reject(executionId(executionIdParam), request);
  }

  /** GET /execution-approval/:executionId?organizationId=&clientId= — derived status + history, scope-checked. */
  @Get(':executionId')
  getStatus(
    @Param('executionId') executionIdParam: string,
    @Query('organizationId') organizationId?: string,
    @Query('clientId') clientId?: string,
  ): Promise<ExecutionApprovalStatusResponseDto> {
    return this.executionApprovalService.getStatus(
      executionId(executionIdParam),
      organizationId,
      clientId,
    );
  }

  /** GET /execution-approval?organizationId=&clientId= — list all decisions in scope. */
  @Get()
  list(
    @Query('organizationId') organizationId?: string,
    @Query('clientId') clientId?: string,
  ): Promise<ExecutionApprovalListResponseDto> {
    return this.executionApprovalService.list(organizationId, clientId);
  }
}
