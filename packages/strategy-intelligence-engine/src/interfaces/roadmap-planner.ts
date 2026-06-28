import type { StrategyOpportunity } from '../opportunities/strategy-opportunity';
import type { RoadmapItem } from '../roadmaps/roadmap-item';

/** RoadmapPlanner — sequences opportunities into a roadmap. Contract only. */
export interface RoadmapPlanner {
  plan(opportunities: readonly StrategyOpportunity[]): readonly RoadmapItem[];
}
