import type { Repository } from '@age/shared';
import type { ProblemAggregate } from '../aggregates/problem.aggregate';

/**
 * ProblemRepository — persistence port for the ProblemAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type ProblemRepository = Repository<ProblemAggregate>;
