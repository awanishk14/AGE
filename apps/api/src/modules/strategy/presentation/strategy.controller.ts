import { Controller } from '@nestjs/common';
import { StrategyService } from '../application/strategy.service';

/**
 * StrategyController — presentation boundary for the strategy domain.
 * Placeholder; no routes defined yet.
 */
@Controller('strategy')
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.strategyService.status();
  }
}
