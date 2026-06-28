import type { StrategyOpportunity } from '../opportunities/strategy-opportunity';
import type { Recommendation } from '../recommendations/recommendation';
import type { RoadmapItem } from '../roadmaps/roadmap-item';
import type { SimulationScenario } from '../simulation/simulation-scenario';
import type { IsoTimestamp } from '../types/common';

/**
 * DecisionPackage — the final structured output of the SIE. A bundle of decision
 * objects for downstream execution engines to consume. The SIE never executes.
 */
export interface DecisionPackage {
  readonly opportunities: readonly StrategyOpportunity[];
  readonly recommendations: readonly Recommendation[];
  readonly roadmap: readonly RoadmapItem[];
  readonly simulations: readonly SimulationScenario[];
  readonly generatedAt: IsoTimestamp;
  /** 0–100. */
  readonly confidenceScore: number;
}
