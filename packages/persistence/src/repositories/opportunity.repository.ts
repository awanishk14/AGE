import type { OpportunityId } from '@age/shared';
import type { OpportunityNode } from '@age/business-knowledge-graph';
import type { PersistenceRepository } from '../interfaces/persistence-repository';

/**
 * OpportunityPersistenceRepository — persistence port for Opportunity. Interface only; no SQL.
 */
export type OpportunityPersistenceRepository = PersistenceRepository<
  OpportunityNode,
  OpportunityId
>;
