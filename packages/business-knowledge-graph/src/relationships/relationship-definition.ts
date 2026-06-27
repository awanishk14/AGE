import type { NodeType, RelationshipType } from '../ontology/business-ontology';

/** A canonical directed relationship definition. */
export interface RelationshipDefinition {
  readonly from: NodeType;
  readonly type: RelationshipType;
  readonly to: NodeType;
}
