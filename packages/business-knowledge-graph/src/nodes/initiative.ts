import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Initiative node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface InitiativeNode extends BusinessNode {
  readonly nodeType: NodeType.Initiative;
}
