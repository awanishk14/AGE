import { Controller } from '@nestjs/common';
import { ResearchService } from '../application/research.service';

/**
 * ResearchController — presentation boundary for the research domain.
 * Placeholder; no routes defined yet.
 */
@Controller('research')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.researchService.status();
  }
}
