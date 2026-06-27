import { Controller } from '@nestjs/common';
import { DecisionService } from '../application/decision.service';

/**
 * DecisionController — presentation boundary for the decision domain.
 * Placeholder; no routes defined yet.
 */
@Controller('decision')
export class DecisionController {
  constructor(private readonly decisionService: DecisionService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.decisionService.status();
  }
}
