import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Service node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface ServiceNode extends BusinessNode {
  readonly nodeType: NodeType.Service;
}
