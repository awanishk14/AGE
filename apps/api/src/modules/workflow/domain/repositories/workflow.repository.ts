import type { Repository } from '@age/shared';
import type { WorkflowAggregate } from '../aggregates/workflow.aggregate';

/**
 * WorkflowRepository — persistence port for the WorkflowAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type WorkflowRepository = Repository<WorkflowAggregate>;
