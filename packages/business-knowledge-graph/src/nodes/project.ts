import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Project node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface ProjectNode extends BusinessNode {
  readonly nodeType: NodeType.Project;
}
