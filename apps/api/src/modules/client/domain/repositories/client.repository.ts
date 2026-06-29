import type { Repository } from '@age/shared';
import type { OrganizationId } from '@age/shared';
import type { ClientAggregate } from '../aggregates/client.aggregate';

export interface ClientRepository extends Repository<ClientAggregate> {
  findByOrganization(organizationId: OrganizationId): Promise<ClientAggregate[]>;
}
