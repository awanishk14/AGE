import { Module } from '@nestjs/common';
import { DecisionController } from './presentation/decision.controller';
import { DecisionService } from './application/decision.service';

/**
 * DecisionModule — domain module for the decision bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [DecisionController],
  providers: [DecisionService],
  exports: [DecisionService],
})
export class DecisionModule {}
