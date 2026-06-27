import { Module } from '@nestjs/common';
import { ProjectController } from './presentation/project.controller';
import { ProjectService } from './application/project.service';

/**
 * ProjectModule — domain module for the project bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
