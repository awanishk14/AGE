/** The set of relationship verbs recognised by the AGE knowledge graph. */
export type RelationshipType =
  | 'OWNS'
  | 'OFFERS'
  | 'SOLVES'
  | 'BELONGS_TO'
  | 'CONTAINS'
  | 'PROMOTES'
  | 'SUPPORTS'
  | 'GENERATES'
  | 'CREATES'
  | 'EXECUTES';

/** A directed relationship between two ontology concepts. Placeholder. */
export interface RelationshipDefinition {
  readonly from: string;
  readonly type: RelationshipType;
  readonly to: string;
}
