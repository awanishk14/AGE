import { Injectable } from '@nestjs/common';

/**
 * WorkflowService — application service (use-cases) for the workflow domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class WorkflowService {
  /** Placeholder status indicator for the scaffolded workflow module. */
  status(): string {
    return 'workflow module: scaffold only';
  }
}
