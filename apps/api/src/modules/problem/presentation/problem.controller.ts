import { Controller } from '@nestjs/common';
import { ProblemService } from '../application/problem.service';

/**
 * ProblemController — presentation boundary for the problem domain.
 * Placeholder; no routes defined yet.
 */
@Controller('problem')
export class ProblemController {
  constructor(private readonly problemService: ProblemService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.problemService.status();
  }
}
