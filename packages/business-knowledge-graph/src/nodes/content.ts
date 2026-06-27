import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Content node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface ContentNode extends BusinessNode {
  readonly nodeType: NodeType.Content;
}
