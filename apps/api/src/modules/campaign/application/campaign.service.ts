import { Injectable } from '@nestjs/common';

/**
 * CampaignService — application service (use-cases) for the campaign domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class CampaignService {
  /** Placeholder status indicator for the scaffolded campaign module. */
  status(): string {
    return 'campaign module: scaffold only';
  }
}
