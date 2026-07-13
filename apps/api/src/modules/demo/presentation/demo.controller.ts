import { Controller, Get } from '@nestjs/common';
import { DemoService } from '../application/demo.service';
import type { CapabilityDemoResponse } from '../application/dto';

/**
 * DemoController — presentation boundary for the in-memory capability demo.
 *
 * Exposes a single read-only route. No auth, no persistence, no side effects.
 */
@Controller('demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  /**
   * GET /demo/capabilities — run the six pure capabilities in-memory and return
   * their human-reviewable decision reports. Read-only.
   */
  @Get('capabilities')
  getCapabilities(): Promise<CapabilityDemoResponse> {
    return this.demoService.getCapabilityDemo();
  }
}
