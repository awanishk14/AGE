import { Module } from '@nestjs/common';
import { CampaignController } from './presentation/campaign.controller';
import { CampaignService } from './application/campaign.service';

/**
 * CampaignModule — domain module for the campaign bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
