import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Competitor node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface CompetitorNode extends BusinessNode {
  readonly nodeType: NodeType.Competitor;
}
