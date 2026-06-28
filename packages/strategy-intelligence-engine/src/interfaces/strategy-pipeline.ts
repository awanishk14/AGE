import type { StrategyContext } from '../analysis/strategy-context';
import type { DecisionPackage } from '../orchestrator/decision-package';

/**
 * StrategyPipeline — orchestrates the full SIE flow and returns a DecisionPackage.
 * Contract only; no runtime logic. SIE consumes BIF/RIE/BKG and never writes to them.
 */
export interface StrategyPipeline {
  run(context: StrategyContext): Promise<DecisionPackage>;
}
