import type { Repository } from '@age/shared';
import type { CampaignAggregate } from '../aggregates/campaign.aggregate';

/**
 * CampaignRepository — persistence port for the CampaignAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type CampaignRepository = Repository<CampaignAggregate>;
