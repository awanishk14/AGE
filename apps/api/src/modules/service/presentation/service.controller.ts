import { Controller } from '@nestjs/common';
import { ServiceService } from '../application/service.service';

/**
 * ServiceController — presentation boundary for the service domain.
 * Placeholder; no routes defined yet.
 */
@Controller('service')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.serviceService.status();
  }
}
