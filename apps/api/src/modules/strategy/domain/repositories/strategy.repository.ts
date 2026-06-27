import type { Repository } from '@age/shared';
import type { StrategyAggregate } from '../aggregates/strategy.aggregate';

/**
 * StrategyRepository — persistence port for the StrategyAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type StrategyRepository = Repository<StrategyAggregate>;
