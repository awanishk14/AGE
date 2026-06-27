import { describe, expect, it } from 'vitest';
import { CampaignService } from '../application/campaign.service';

describe('CampaignModule', () => {
  it('service returns a placeholder status', () => {
    expect(new CampaignService().status()).toContain('campaign');
  });
});
