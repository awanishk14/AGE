import type { Repository } from '@age/shared';
import type { DecisionAggregate } from '../aggregates/decision.aggregate';

/**
 * DecisionRepository — persistence port for the DecisionAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type DecisionRepository = Repository<DecisionAggregate>;
