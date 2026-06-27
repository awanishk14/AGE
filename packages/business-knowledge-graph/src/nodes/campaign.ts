import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Campaign node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface CampaignNode extends BusinessNode {
  readonly nodeType: NodeType.Campaign;
}
