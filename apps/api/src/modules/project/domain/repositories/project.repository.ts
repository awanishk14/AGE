import type { Repository } from '@age/shared';
import type { ProjectAggregate } from '../aggregates/project.aggregate';

/**
 * ProjectRepository — persistence port for the ProjectAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type ProjectRepository = Repository<ProjectAggregate>;
