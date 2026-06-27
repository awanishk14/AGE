import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Strategy node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface StrategyNode extends BusinessNode {
  readonly nodeType: NodeType.Strategy;
}
