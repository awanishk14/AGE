import type { ExecutionDomain } from '@age/capability-kit';
import type { RevenuePlanTarget } from './revenue-plan-target';

/**
 * RevenuePlanReference — a small, read-only, neutral VALUE shape mirroring the
 * minimal upstream opportunity/plan/decision fields Revenue reads (ADR-0019).
 *
 * NOT a backdoor dependency on any producer capability's internals: declared
 * independently in @age/revenue-contracts, carries only plain data fields, and
 * is never imported/re-exported from @age/capability-market-discovery,
 * @age/capability-growth, @age/capability-authority, @age/capability-operations,
 * @age/market-discovery-contracts, @age/growth-contracts, @age/authority-contracts,
 * or @age/operations-contracts. Revenue consumes upstream *concepts* through this
 * neutral contract, never a producer package.
 *
 * `referenceType` is a plain string mirror (e.g. 'OPPORTUNITY', 'GROWTH_PLAN',
 * 'AUTHORITY_PLAN', 'OPERATIONS_PLAN', 'SIE_DECISION'). Operations output can
 * only appear here as `referenceType: 'OPERATIONS_PLAN'` — never by importing
 * @age/capability-operations or @age/operations-contracts.
 *
 * `target` is a RevenuePlanTarget. Its `executionDomains` are upstream/provenance
 * context only — the authoritative execution-domain tags for a plan come from the
 * planning item, not this reference (enforced at the capability layer later).
 */
export interface RevenuePlanReference {
  readonly referenceId: string;
  readonly referenceType: string;
  readonly target: RevenuePlanTarget;
  readonly executionDomains: readonly ExecutionDomain[];

  /** 0–100, provenance/context only; planning item values are authoritative. */
  readonly expectedValueScore: number;

  /** 0–100, provenance/context only; planning item values are authoritative. */
  readonly conversionProbabilityScore: number;

  /** 0–100, provenance/context only; planning item values are authoritative. */
  readonly retentionRiskScore: number;

  /** 0–100, provenance/context only; planning item values are authoritative. */
  readonly confidenceScore: number;
}
