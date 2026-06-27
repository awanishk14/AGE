import type { Repository } from '@age/shared';
import type { IntegrationAggregate } from '../aggregates/integration.aggregate';

/**
 * IntegrationRepository — persistence port for the IntegrationAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type IntegrationRepository = Repository<IntegrationAggregate>;
