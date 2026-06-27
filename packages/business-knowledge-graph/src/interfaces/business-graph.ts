import type { BusinessNode } from './business-node';
import type { BusinessRelationship } from './business-relationship';

/**
 * BusinessGraph — a read model of nodes and relationships. Interface only.
 */
export interface BusinessGraph {
  readonly nodes: readonly BusinessNode[];
  readonly relationships: readonly BusinessRelationship[];
}
