import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Decision node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface DecisionNode extends BusinessNode {
  readonly nodeType: NodeType.Decision;
}
