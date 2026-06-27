import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Product node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface ProductNode extends BusinessNode {
  readonly nodeType: NodeType.Product;
}
