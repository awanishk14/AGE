import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Organization node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface OrganizationNode extends BusinessNode {
  readonly nodeType: NodeType.Organization;
}
