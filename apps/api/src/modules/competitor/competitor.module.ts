import { Module } from '@nestjs/common';
import { CompetitorController } from './presentation/competitor.controller';
import { CompetitorService } from './application/competitor.service';

/**
 * CompetitorModule — domain module for the competitor bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [CompetitorController],
  providers: [CompetitorService],
  exports: [CompetitorService],
})
export class CompetitorModule {}
