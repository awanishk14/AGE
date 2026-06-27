import { Module } from '@nestjs/common';
import { ReportingController } from './presentation/reporting.controller';
import { ReportingService } from './application/reporting.service';

/**
 * ReportingModule — domain module for the reporting bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}
