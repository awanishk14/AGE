import type { Repository } from '@age/shared';
import type { ProductAggregate } from '../aggregates/product.aggregate';

/**
 * ProductRepository — persistence port for the ProductAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type ProductRepository = Repository<ProductAggregate>;
