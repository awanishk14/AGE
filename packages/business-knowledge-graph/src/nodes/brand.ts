import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Brand node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface BrandNode extends BusinessNode {
  readonly nodeType: NodeType.Brand;
}
