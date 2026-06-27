import type { Repository } from '@age/shared';
import type { ContentAggregate } from '../aggregates/content.aggregate';

/**
 * ContentRepository — persistence port for the ContentAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type ContentRepository = Repository<ContentAggregate>;
