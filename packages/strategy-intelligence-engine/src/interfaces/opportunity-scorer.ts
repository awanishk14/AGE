import type { StrategyOpportunity } from '../opportunities/strategy-opportunity';
import type { PriorityScore } from '../prioritization/priority-score';

/** OpportunityScorer — scores an opportunity. Contract only; no formulas. */
export interface OpportunityScorer {
  score(opportunity: StrategyOpportunity): PriorityScore;
}
