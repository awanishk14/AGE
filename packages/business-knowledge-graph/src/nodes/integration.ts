import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Integration node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface IntegrationNode extends BusinessNode {
  readonly nodeType: NodeType.Integration;
}
