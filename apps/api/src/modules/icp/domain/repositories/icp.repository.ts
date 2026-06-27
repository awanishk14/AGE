import type { Repository } from '@age/shared';
import type { IcpAggregate } from '../aggregates/icp.aggregate';

/**
 * IcpRepository — persistence port for the IcpAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type IcpRepository = Repository<IcpAggregate>;
