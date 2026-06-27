import { Module } from '@nestjs/common';
import { KnowledgeController } from './presentation/knowledge.controller';
import { KnowledgeService } from './application/knowledge.service';

/**
 * KnowledgeModule — domain module for the knowledge bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
