import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Person node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface PersonNode extends BusinessNode {
  readonly nodeType: NodeType.Person;
}
