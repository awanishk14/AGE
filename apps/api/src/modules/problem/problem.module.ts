import { Module } from '@nestjs/common';
import { ProblemController } from './presentation/problem.controller';
import { ProblemService } from './application/problem.service';

/**
 * ProblemModule — domain module for the problem bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [ProblemController],
  providers: [ProblemService],
  exports: [ProblemService],
})
export class ProblemModule {}
