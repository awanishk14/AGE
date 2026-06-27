import { Controller } from '@nestjs/common';
import { CampaignService } from '../application/campaign.service';

/**
 * CampaignController — presentation boundary for the campaign domain.
 * Placeholder; no routes defined yet.
 */
@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.campaignService.status();
  }
}
