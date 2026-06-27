import type { BusinessQuery } from '../interfaces/business-query';
import type { ProductNode } from '../nodes';

/** FindProducts — placeholder query contract. No traversal logic. */
export type FindProducts = BusinessQuery<readonly ProductNode[]>;
