import type { BusinessNode } from '../interfaces/business-node';
import type { NodeType } from '../ontology/business-ontology';

/** Metric node in the Business Knowledge Graph. Placeholder; no implementation. */
export interface MetricNode extends BusinessNode {
  readonly nodeType: NodeType.Metric;
}
