import type { Repository } from '@age/shared';
import type { EvidenceAggregate } from '../aggregates/evidence.aggregate';

/**
 * EvidenceRepository — persistence port for the EvidenceAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type EvidenceRepository = Repository<EvidenceAggregate>;
