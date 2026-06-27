import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Workflow node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface WorkflowNode extends BusinessNode {
  readonly nodeType: NodeType.Workflow;
}
