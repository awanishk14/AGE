import type { Repository } from '@age/shared';
import type { ResearchAggregate } from '../aggregates/research.aggregate';

/**
 * ResearchRepository — persistence port for the ResearchAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type ResearchRepository = Repository<ResearchAggregate>;
