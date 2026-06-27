import { Module } from '@nestjs/common';
import { ResearchController } from './presentation/research.controller';
import { ResearchService } from './application/research.service';

/**
 * ResearchModule — domain module for the research bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [ResearchController],
  providers: [ResearchService],
  exports: [ResearchService],
})
export class ResearchModule {}
