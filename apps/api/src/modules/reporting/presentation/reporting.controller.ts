import { Controller } from '@nestjs/common';
import { ReportingService } from '../application/reporting.service';

/**
 * ReportingController — presentation boundary for the reporting domain.
 * Placeholder; no routes defined yet.
 */
@Controller('reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.reportingService.status();
  }
}
