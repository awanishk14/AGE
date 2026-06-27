import type { CampaignId } from '@age/shared';
import type { CampaignNode } from '@age/business-knowledge-graph';
import type { PersistenceRepository } from '../interfaces/persistence-repository';

/**
 * CampaignPersistenceRepository — persistence port for Campaign. Interface only; no SQL.
 */
export type CampaignPersistenceRepository = PersistenceRepository<CampaignNode, CampaignId>;
