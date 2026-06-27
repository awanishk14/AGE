import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Document node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface DocumentNode extends BusinessNode {
  readonly nodeType: NodeType.Document;
}
