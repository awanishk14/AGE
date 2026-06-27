import { Controller } from '@nestjs/common';
import { MarketService } from '../application/market.service';

/**
 * MarketController — presentation boundary for the market domain.
 * Placeholder; no routes defined yet.
 */
@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.marketService.status();
  }
}
