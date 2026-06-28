/** A cluster of evidence pointing at a single buyer/market intent. */
export interface IntentCluster {
  readonly topic: string;
  /** 0–100. */
  readonly urgencyScore: number;
  /** 0–100. */
  readonly buyingProbability: number;
  readonly relatedKeywords: readonly string[];
  readonly evidenceIds: readonly string[];
}
