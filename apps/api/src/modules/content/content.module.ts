import { Module } from '@nestjs/common';
import { ContentController } from './presentation/content.controller';
import { ContentService } from './application/content.service';

/**
 * ContentModule — domain module for the content bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
