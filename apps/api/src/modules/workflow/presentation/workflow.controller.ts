import { Controller } from '@nestjs/common';
import { WorkflowService } from '../application/workflow.service';

/**
 * WorkflowController — presentation boundary for the workflow domain.
 * Placeholder; no routes defined yet.
 */
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.workflowService.status();
  }
}
