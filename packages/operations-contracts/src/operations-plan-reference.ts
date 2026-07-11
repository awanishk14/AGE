import type { ExecutionDomain } from '@age/capability-kit';
import type { OperationsPlanTarget } from './operations-plan-target';

/**
 * OperationsPlanReference — a small, read-only, neutral VALUE shape mirroring the
 * minimal upstream opportunity/plan/decision fields Operations reads (ADR-0018).
 *
 * NOT a backdoor dependency on any producer capability's internals: declared
 * independently in @age/operations-contracts, carries only plain data fields, and
 * is never imported/re-exported from @age/capability-market-discovery,
 * @age/capability-growth, @age/capability-authority, @age/market-discovery-contracts,
 * @age/growth-contracts, or @age/authority-contracts. Operations consumes upstream
 * *concepts* through this neutral contract, never a producer package.
 *
 * `referenceType` is a plain string mirror (e.g. 'OPPORTUNITY', 'GROWTH_PLAN',
 * 'AUTHORITY_PLAN'). `target` is an OperationsPlanTarget. Its `executionDomains`
 * are upstream/provenance context only — the authoritative execution-domain tags
 * for a plan come from the planning item, not this reference (enforced at the
 * capability layer later).
 */
export interface OperationsPlanReference {
  readonly referenceId: string;
  readonly referenceType: string;
  readonly target: OperationsPlanTarget;
  readonly executionDomains: readonly ExecutionDomain[];
  /** 0–100, as observed upstream. Deadline/SLA pressure. */
  readonly urgencyScore: number;
  /** 0–100, as observed upstream. Risk of delivery slippage / QA failure. */
  readonly deliveryRiskScore: number;
  /** 0–100, as observed upstream. */
  readonly confidenceScore: number;
}
