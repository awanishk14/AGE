/**
 * GrowthPlanSourceRef — provenance tying a derived growth plan back to the
 * originating opportunity reference. A single accepted plan may carry several of
 * these once structural duplicates are merged into it. Data contract only.
 */
export interface GrowthPlanSourceRef {
  readonly opportunityId: string;
}
