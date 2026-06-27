import { Controller } from '@nestjs/common';
import { CompetitorService } from '../application/competitor.service';

/**
 * CompetitorController — presentation boundary for the competitor domain.
 * Placeholder; no routes defined yet.
 */
@Controller('competitor')
export class CompetitorController {
  constructor(private readonly competitorService: CompetitorService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.competitorService.status();
  }
}
