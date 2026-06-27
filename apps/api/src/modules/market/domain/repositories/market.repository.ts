import type { Repository } from '@age/shared';
import type { MarketAggregate } from '../aggregates/market.aggregate';

/**
 * MarketRepository — persistence port for the MarketAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type MarketRepository = Repository<MarketAggregate>;
