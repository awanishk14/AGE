import type { Repository } from '@age/shared';
import type { KnowledgeAggregate } from '../aggregates/knowledge.aggregate';

/**
 * KnowledgeRepository — persistence port for the KnowledgeAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type KnowledgeRepository = Repository<KnowledgeAggregate>;
