import type { StrategyOpportunity } from '../opportunities/strategy-opportunity';
import type { Recommendation } from '../recommendations/recommendation';

/** RecommendationEngine — derives recommendations. Contract only. */
export interface RecommendationEngine {
  recommend(opportunity: StrategyOpportunity): readonly Recommendation[];
}
