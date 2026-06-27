import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Market node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface MarketNode extends BusinessNode {
  readonly nodeType: NodeType.Market;
}
