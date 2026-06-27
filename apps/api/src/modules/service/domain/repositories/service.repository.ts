import type { Repository } from '@age/shared';
import type { ServiceAggregate } from '../aggregates/service.aggregate';

/**
 * ServiceRepository — persistence port for the ServiceAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type ServiceRepository = Repository<ServiceAggregate>;
