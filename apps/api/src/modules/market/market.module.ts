import { Module } from '@nestjs/common';
import { MarketController } from './presentation/market.controller';
import { MarketService } from './application/market.service';

/**
 * MarketModule — domain module for the market bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
