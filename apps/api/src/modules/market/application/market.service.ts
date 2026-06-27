import { Injectable } from '@nestjs/common';

/**
 * MarketService — application service (use-cases) for the market domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class MarketService {
  /** Placeholder status indicator for the scaffolded market module. */
  status(): string {
    return 'market module: scaffold only';
  }
}
