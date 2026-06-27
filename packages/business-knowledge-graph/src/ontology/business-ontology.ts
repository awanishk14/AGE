/**
 * BusinessOntology — the canonical vocabulary of the AGE Business Knowledge Graph.
 *
 * Definitions only: the set of node types, the set of relationship types, and a
 * registry that enumerates them. No traversal, inference or persistence.
 */

/** Every concept (node) AGE can represent about an organization. */
export enum NodeType {
  Organization = 'Organization',
  Person = 'Person',
  Brand = 'Brand',
  Product = 'Product',
  Service = 'Service',
  Market = 'Market',
  ICP = 'ICP',
  Competitor = 'Competitor',
  Strategy = 'Strategy',
  Goal = 'Goal',
  Initiative = 'Initiative',
  Campaign = 'Campaign',
  Content = 'Content',
  Research = 'Research',
  Evidence = 'Evidence',
  Decision = 'Decision',
  Project = 'Project',
  Workflow = 'Workflow',
  Asset = 'Asset',
  Integration = 'Integration',
  Problem = 'Problem',
  Opportunity = 'Opportunity',
  Metric = 'Metric',
  Document = 'Document',
  Meeting = 'Meeting',
  Technology = 'Technology',
}

/** Every directed relationship (edge) verb AGE recognises. */
export enum RelationshipType {
  OWNS = 'OWNS',
  OFFERS = 'OFFERS',
  SOLVES = 'SOLVES',
  EXISTS_IN = 'EXISTS_IN',
  CONTAINS = 'CONTAINS',
  TARGETS = 'TARGETS',
  DEFINES = 'DEFINES',
  CREATES = 'CREATES',
  PROMOTES = 'PROMOTES',
  SUPPORTS = 'SUPPORTS',
  GENERATES = 'GENERATES',
  EXECUTES = 'EXECUTES',
  PRODUCES = 'PRODUCES',
  ENABLES = 'ENABLES',
  CONNECTS = 'CONNECTS',
  IMPACTS = 'IMPACTS',
}

/** A canonical, directed relationship between two node types. */
export interface OntologyRelationship {
  readonly from: NodeType;
  readonly type: RelationshipType;
  readonly to: NodeType;
}

/**
 * ONTOLOGY_REGISTRY — the canonical definition of the business ontology.
 * Definitions only; consumers (queries, graph, builders) read from it later.
 */
export const ONTOLOGY_REGISTRY = {
  nodeTypes: Object.values(NodeType),
  relationshipTypes: Object.values(RelationshipType),
  relationships: [
    { from: NodeType.Organization, type: RelationshipType.OWNS, to: NodeType.Brand },
    { from: NodeType.Brand, type: RelationshipType.OFFERS, to: NodeType.Product },
    { from: NodeType.Product, type: RelationshipType.SOLVES, to: NodeType.Problem },
    { from: NodeType.Problem, type: RelationshipType.EXISTS_IN, to: NodeType.Market },
    { from: NodeType.Market, type: RelationshipType.CONTAINS, to: NodeType.Competitor },
    { from: NodeType.Competitor, type: RelationshipType.TARGETS, to: NodeType.ICP },
    { from: NodeType.Strategy, type: RelationshipType.DEFINES, to: NodeType.Goal },
    { from: NodeType.Goal, type: RelationshipType.CREATES, to: NodeType.Initiative },
    { from: NodeType.Initiative, type: RelationshipType.CREATES, to: NodeType.Project },
    { from: NodeType.Campaign, type: RelationshipType.PROMOTES, to: NodeType.Product },
    { from: NodeType.Campaign, type: RelationshipType.TARGETS, to: NodeType.ICP },
    { from: NodeType.Content, type: RelationshipType.SUPPORTS, to: NodeType.Campaign },
    { from: NodeType.Research, type: RelationshipType.GENERATES, to: NodeType.Evidence },
    { from: NodeType.Evidence, type: RelationshipType.SUPPORTS, to: NodeType.Decision },
    { from: NodeType.Decision, type: RelationshipType.CREATES, to: NodeType.Workflow },
    { from: NodeType.Workflow, type: RelationshipType.EXECUTES, to: NodeType.Project },
    { from: NodeType.Project, type: RelationshipType.PRODUCES, to: NodeType.Metric },
    { from: NodeType.Meeting, type: RelationshipType.PRODUCES, to: NodeType.Decision },
    { from: NodeType.Document, type: RelationshipType.SUPPORTS, to: NodeType.Strategy },
    { from: NodeType.Technology, type: RelationshipType.ENABLES, to: NodeType.Workflow },
    { from: NodeType.Integration, type: RelationshipType.CONNECTS, to: NodeType.Technology },
    { from: NodeType.Opportunity, type: RelationshipType.IMPACTS, to: NodeType.Goal },
  ] as readonly OntologyRelationship[],
} as const;
