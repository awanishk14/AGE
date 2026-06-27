import type { Repository } from '@age/shared';
import type { PeopleAggregate } from '../aggregates/people.aggregate';

/**
 * PeopleRepository — persistence port for the PeopleAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type PeopleRepository = Repository<PeopleAggregate>;
