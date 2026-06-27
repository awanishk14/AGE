import type { UniqueId } from '@age/shared';
import type { NodeType } from '../ontology/business-ontology';

/**
 * BusinessNode — the common shape of every node in the Business Knowledge Graph.
 * Interface only; no implementation.
 */
export interface BusinessNode {
  readonly id: UniqueId;
  readonly nodeType: NodeType;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
