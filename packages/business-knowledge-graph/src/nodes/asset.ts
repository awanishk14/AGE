import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Asset node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface AssetNode extends BusinessNode {
  readonly nodeType: NodeType.Asset;
}
