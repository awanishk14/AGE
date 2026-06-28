/** A concrete recommendation tied to an opportunity. */
export interface Recommendation {
  readonly id: string;
  readonly opportunityId: string;
  readonly recommendation: string;
  readonly rationale: string;
  readonly expectedOutcome: string;
  readonly dependencies: readonly string[];
  /** 0–100. */
  readonly confidence: number;
}
