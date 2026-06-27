import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Problem node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface ProblemNode extends BusinessNode {
  readonly nodeType: NodeType.Problem;
}
