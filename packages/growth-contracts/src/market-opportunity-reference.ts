import type { ExecutionDomain } from '@age/capability-kit';
import type { GrowthPlanTarget } from './growth-plan-target';

/**
 * MarketOpportunityReference — a small, read-only, neutral VALUE shape mirroring
 * the minimal Market Discovery opportunity fields Growth reads (ADR-0014).
 *
 * This is NOT a backdoor dependency on Market Discovery internals: it is declared
 * independently in @age/growth-contracts, carries only plain data fields, and is
 * never imported or re-exported from @age/capability-market-discovery or
 * @age/market-discovery-contracts. Growth consumes Market Discovery *concepts*
 * through this neutral contract, never the capability package.
 *
 * `opportunityType` is a plain string mirror (not Market Discovery's enum).
 * `target` is a GrowthPlanTarget (a Growth planning target), not the original
 * Market Discovery target model.
 */
export interface MarketOpportunityReference {
  readonly opportunityId: string;
  readonly opportunityType: string;
  readonly target: GrowthPlanTarget;
  readonly executionDomains: readonly ExecutionDomain[];
  /** 0–100, as observed upstream. */
  readonly impactScore: number;
  /** 0–100, as observed upstream. */
  readonly confidenceScore: number;
}
