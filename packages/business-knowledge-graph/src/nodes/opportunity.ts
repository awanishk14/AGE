import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Opportunity node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface OpportunityNode extends BusinessNode {
  readonly nodeType: NodeType.Opportunity;
}
