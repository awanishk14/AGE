import type { BusinessGraph } from './business-graph';
import type { BusinessNode } from './business-node';
import type { BusinessRelationship } from './business-relationship';

/**
 * GraphBuilder — fluent contract for assembling a BusinessGraph. Interface only.
 */
export interface GraphBuilder {
  addNode(node: BusinessNode): this;
  addRelationship(relationship: BusinessRelationship): this;
  build(): BusinessGraph;
}
