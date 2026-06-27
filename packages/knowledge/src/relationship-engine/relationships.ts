import type { RelationshipDefinition } from './relationship-definition';

/**
 * RELATIONSHIPS — placeholder relationship definitions for the knowledge graph.
 * Definitions only; no traversal or inference engine is implemented yet.
 */
export const RELATIONSHIPS: readonly RelationshipDefinition[] = [
  { from: 'Organization', type: 'OWNS', to: 'Brand' },
  { from: 'Brand', type: 'OFFERS', to: 'Product' },
  { from: 'Product', type: 'SOLVES', to: 'Problem' },
  { from: 'Problem', type: 'BELONGS_TO', to: 'Market' },
  { from: 'Market', type: 'CONTAINS', to: 'Competitor' },
  { from: 'Campaign', type: 'PROMOTES', to: 'Product' },
  { from: 'Content', type: 'SUPPORTS', to: 'Campaign' },
  { from: 'Evidence', type: 'SUPPORTS', to: 'Decision' },
  { from: 'Research', type: 'GENERATES', to: 'Evidence' },
  { from: 'Decision', type: 'CREATES', to: 'Project' },
  { from: 'Project', type: 'EXECUTES', to: 'Strategy' },
];
