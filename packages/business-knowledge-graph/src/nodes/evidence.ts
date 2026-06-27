import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Evidence node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface EvidenceNode extends BusinessNode {
  readonly nodeType: NodeType.Evidence;
}
