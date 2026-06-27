import type { BusinessQuery } from '../interfaces/business-query';
import type { StrategyNode } from '../nodes';

/** FindStrategy — placeholder query contract. No traversal logic. */
export type FindStrategy = BusinessQuery<StrategyNode | null>;
