# @age/strategy-intelligence-engine (SIE)

The **Decision Layer** of AGE. Consumes BIF, RIE and BKG (by reference) and produces structured
**decision objects** — it never executes anything and never writes to its inputs.

**Hard rules:** no business logic, no calculations, no formulas, no AI prompting, no APIs, no DB.
Contracts, types, enums and Zod schemas only.

```
Evidence → Business Truth → Opportunity Discovery → Prioritization →
Recommendations → Roadmap → Simulation → Decision Package

src/
  types/           OpportunityCategory, Priority, RoadmapPhase
  analysis/        StrategyContext (read-only inputs)
  opportunities/   StrategyOpportunity
  prioritization/  PriorityScore
  recommendations/ Recommendation
  roadmaps/        RoadmapItem
  simulation/      SimulationScenario
  scoring/         ScoreDimension (dimensions only, no formulas)
  interfaces/      OpportunityScorer, RecommendationEngine, PriorityEngine,
                   RoadmapPlanner, SimulationEngine, StrategyPipeline
  orchestrator/    DecisionPackage + StrategyStage + STRATEGY_FLOW
  validators/      Zod schemas
  index.ts
```
