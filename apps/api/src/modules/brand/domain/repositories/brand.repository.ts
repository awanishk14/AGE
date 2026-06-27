import type { Repository } from '@age/shared';
import type { BrandAggregate } from '../aggregates/brand.aggregate';

/**
 * BrandRepository — persistence port for the BrandAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type BrandRepository = Repository<BrandAggregate>;
