import { Module } from '@nestjs/common';
import { WorkflowController } from './presentation/workflow.controller';
import { WorkflowService } from './application/workflow.service';

/**
 * WorkflowModule — domain module for the workflow bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
