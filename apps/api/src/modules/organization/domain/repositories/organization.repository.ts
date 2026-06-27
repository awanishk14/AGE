import type { Repository } from '@age/shared';
import type { OrganizationAggregate } from '../aggregates/organization.aggregate';

/**
 * OrganizationRepository — persistence port for the OrganizationAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type OrganizationRepository = Repository<OrganizationAggregate>;
