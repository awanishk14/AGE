import type { StrategyOpportunity } from '../opportunities/strategy-opportunity';

/** PriorityEngine — orders opportunities by priority. Contract only. */
export interface PriorityEngine {
  prioritize(opportunities: readonly StrategyOpportunity[]): readonly StrategyOpportunity[];
}
