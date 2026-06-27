import { Controller } from '@nestjs/common';
import { IntegrationService } from '../application/integration.service';

/**
 * IntegrationController — presentation boundary for the integration domain.
 * Placeholder; no routes defined yet.
 */
@Controller('integration')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.integrationService.status();
  }
}
