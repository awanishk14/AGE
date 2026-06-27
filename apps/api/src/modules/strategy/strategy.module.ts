import { Module } from '@nestjs/common';
import { StrategyController } from './presentation/strategy.controller';
import { StrategyService } from './application/strategy.service';

/**
 * StrategyModule — domain module for the strategy bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [StrategyController],
  providers: [StrategyService],
  exports: [StrategyService],
})
export class StrategyModule {}
