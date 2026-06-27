/**
 * @age/knowledge — knowledge base & agent context primitives for the AGE platform.
 *
 * Scaffold only. Interfaces, ontology and relationship definitions; no logic yet.
 */
export const AGE_KNOWLEDGE_PACKAGE = '@age/knowledge' as const;

export * from './business-knowledge-graph.interface';
export * from './ontology.interface';
export * from './relationship-engine.interface';
export * from './evidence-model.interface';
export * from './decision-model.interface';
export * from './ontology';
export * from './relationship-engine';
