import { Controller } from '@nestjs/common';
import { ProjectService } from '../application/project.service';

/**
 * ProjectController — presentation boundary for the project domain.
 * Placeholder; no routes defined yet.
 */
@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.projectService.status();
  }
}
