/**
 * @age/business-knowledge-graph — the canonical Business Knowledge Graph (BKG).
 *
 * Pure, framework-independent domain model: ontology, node & relationship
 * definitions, graph/query/builder interfaces. No DB, no Prisma, no NestJS,
 * no graph algorithms.
 */
export const AGE_BKG_PACKAGE = '@age/business-knowledge-graph' as const;

export * from './ontology';
export * from './interfaces';
export * from './nodes';
export * from './relationships';
export * from './queries';
export * from './builders';
export * from './graph';
export * from './types';
