import { NodeType, RelationshipType } from '../ontology/business-ontology';
import type { RelationshipDefinition } from './relationship-definition';

/**
 * RELATIONSHIP_DEFINITIONS — the canonical relationship set of the BKG.
 * Definitions only; no graph traversal or inference.
 */
export const RELATIONSHIP_DEFINITIONS: readonly RelationshipDefinition[] = [
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
];
