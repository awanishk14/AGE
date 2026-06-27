/**
 * OntologyNode — the common shape every AGE ontology object exposes.
 *
 * Placeholder. Describes a concept in the Business Knowledge Graph.
 */
export interface OntologyNode {
  readonly name: string;
  readonly description: string;
  readonly relationships: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
