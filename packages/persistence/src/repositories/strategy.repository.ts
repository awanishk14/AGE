import type { StrategyId } from '@age/shared';
import type { StrategyNode } from '@age/business-knowledge-graph';
import type { PersistenceRepository } from '../interfaces/persistence-repository';

/**
 * StrategyPersistenceRepository — persistence port for Strategy. Interface only; no SQL.
 */
export type StrategyPersistenceRepository = PersistenceRepository<StrategyNode, StrategyId>;
