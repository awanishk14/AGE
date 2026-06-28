import type { StrategyOpportunity } from '../opportunities/strategy-opportunity';
import type { SimulationScenario } from '../simulation/simulation-scenario';

/** SimulationEngine — produces what-if scenarios. Contract only. */
export interface SimulationEngine {
  simulate(opportunity: StrategyOpportunity): readonly SimulationScenario[];
}
