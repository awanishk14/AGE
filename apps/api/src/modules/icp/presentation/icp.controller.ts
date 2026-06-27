import { Controller } from '@nestjs/common';
import { IcpService } from '../application/icp.service';

/**
 * IcpController — presentation boundary for the icp domain.
 * Placeholder; no routes defined yet.
 */
@Controller('icp')
export class IcpController {
  constructor(private readonly icpService: IcpService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.icpService.status();
  }
}
