/** The ordered stages of the SIE strategy flow. */
export enum StrategyStage {
  Evidence = 'EVIDENCE',
  BusinessTruth = 'BUSINESS_TRUTH',
  OpportunityDiscovery = 'OPPORTUNITY_DISCOVERY',
  Prioritization = 'PRIORITIZATION',
  Recommendations = 'RECOMMENDATIONS',
  Roadmap = 'ROADMAP',
  Simulation = 'SIMULATION',
  DecisionPackage = 'DECISION_PACKAGE',
}

/**
 * STRATEGY_FLOW — the canonical order of stages:
 * Evidence → Business Truth → Opportunity Discovery → Prioritization →
 * Recommendations → Roadmap → Simulation → Decision Package.
 * Definition only; no execution.
 */
export const STRATEGY_FLOW: readonly StrategyStage[] = [
  StrategyStage.Evidence,
  StrategyStage.BusinessTruth,
  StrategyStage.OpportunityDiscovery,
  StrategyStage.Prioritization,
  StrategyStage.Recommendations,
  StrategyStage.Roadmap,
  StrategyStage.Simulation,
  StrategyStage.DecisionPackage,
];
