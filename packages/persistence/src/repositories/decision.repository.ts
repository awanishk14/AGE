import type { DecisionId } from '@age/shared';
import type { DecisionNode } from '@age/business-knowledge-graph';
import type { PersistenceRepository } from '../interfaces/persistence-repository';

/**
 * DecisionPersistenceRepository — persistence port for Decision. Interface only; no SQL.
 */
export type DecisionPersistenceRepository = PersistenceRepository<DecisionNode, DecisionId>;
