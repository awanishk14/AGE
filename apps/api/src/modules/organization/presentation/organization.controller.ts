import { Controller } from '@nestjs/common';
import { OrganizationService } from '../application/organization.service';

/**
 * OrganizationController — presentation boundary for the organization domain.
 * Placeholder; no routes defined yet.
 */
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.organizationService.status();
  }
}
