import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Research node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface ResearchNode extends BusinessNode {
  readonly nodeType: NodeType.Research;
}
