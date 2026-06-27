import type { BusinessQuery } from '../interfaces/business-query';
import type { CampaignNode } from '../nodes';

/** FindCampaigns — placeholder query contract. No traversal logic. */
export type FindCampaigns = BusinessQuery<readonly CampaignNode[]>;
