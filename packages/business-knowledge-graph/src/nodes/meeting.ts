import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Meeting node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface MeetingNode extends BusinessNode {
  readonly nodeType: NodeType.Meeting;
}
