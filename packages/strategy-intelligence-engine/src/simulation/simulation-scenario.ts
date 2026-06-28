/** A what-if scenario describing the expected effect of acting on an opportunity. */
export interface SimulationScenario {
  readonly title: string;
  readonly description: string;
  readonly assumptions: readonly string[];
  readonly affectedKPIs: readonly string[];
  readonly expectedChange: string;
  /** 0–100. */
  readonly confidence: number;
}
