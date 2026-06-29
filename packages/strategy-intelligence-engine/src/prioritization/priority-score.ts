/**
 * PriorityScore — the multi-dimensional score of an opportunity.
 * Every dimension is 0–100. No formulas live here (see scoring/ for dimensions).
 */
export interface PriorityScore {
  readonly businessImpact: number;
  readonly revenueImpact: number;
  readonly marketingImpact: number;
  readonly customerImpact: number;
  readonly technicalImpact: number;
  readonly risk: number;
  readonly urgency: number;
  readonly effort: number;
  readonly overallScore: number;
}
