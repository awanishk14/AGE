import type { Repository } from '@age/shared';
import type { CompetitorAggregate } from '../aggregates/competitor.aggregate';

/**
 * CompetitorRepository — persistence port for the CompetitorAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type CompetitorRepository = Repository<CompetitorAggregate>;
