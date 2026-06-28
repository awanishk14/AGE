import type { BIFFieldRef } from '@age/bif';
import type { OpportunityCategory, Priority } from '../types/enums';

/**
 * StrategyOpportunity — a structured, evidence-backed business opportunity.
 *
 * AGE does not recommend tactics; it identifies opportunities and prioritizes
 * actions using evidence. This is a decision object — no execution.
 */
export interface StrategyOpportunity {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: OpportunityCategory;
  readonly priority: Priority;
  /** 0–100. */
  readonly estimatedImpact: number;
  /** 0–100. */
  readonly estimatedEffort: number;
  /** 0–100. */
  readonly confidence: number;
  readonly supportingEvidenceIds: readonly string[];
  readonly supportingBIFFields: readonly BIFFieldRef[];
  readonly assumptions: readonly string[];
  readonly risks: readonly string[];
}
