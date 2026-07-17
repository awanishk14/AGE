import { Module } from '@nestjs/common';
import { InMemoryApprovalDecisionRepository } from '@age/execution-approval-workflow';
import { ExecutionApprovalController } from './presentation/execution-approval.controller';
import {
  ExecutionApprovalService,
  EXECUTION_APPROVAL_REPOSITORY,
} from './application/execution-approval.service';

/**
 * ExecutionApprovalModule — Human Approval Workflow API bounded context
 * (ADR-0023 Slice D2).
 *
 * `ExecutionApprovalService` depends on the abstract `ApprovalDecisionRepository`
 * port (via the `EXECUTION_APPROVAL_REPOSITORY` token); this module binds it
 * to the in-memory reference repository from `@age/execution-approval-workflow`
 * (Slice D1), consistent with the test-safe/demo scope used by prior Phase 5
 * slices. A future durable adapter can be bound to the same token without
 * touching the service. No database/Prisma wiring, no queue, no external
 * integrations, and no execute route — approval only ever records a decision.
 */
@Module({
  controllers: [ExecutionApprovalController],
  providers: [
    ExecutionApprovalService,
    { provide: EXECUTION_APPROVAL_REPOSITORY, useClass: InMemoryApprovalDecisionRepository },
  ],
  exports: [ExecutionApprovalService],
})
export class ExecutionApprovalModule {}
