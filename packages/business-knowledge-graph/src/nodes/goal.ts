import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Goal node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface GoalNode extends BusinessNode {
  readonly nodeType: NodeType.Goal;
}
