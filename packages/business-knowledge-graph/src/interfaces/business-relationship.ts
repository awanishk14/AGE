import type { UniqueId } from '@age/shared';
import type { RelationshipType } from '../ontology/business-ontology';

/**
 * BusinessRelationship — a directed edge between two nodes. Interface only.
 */
export interface BusinessRelationship {
  readonly id: UniqueId;
  readonly type: RelationshipType;
  readonly from: UniqueId;
  readonly to: UniqueId;
  readonly metadata: Readonly<Record<string, unknown>>;
}
