import type { ExecutionDomain } from '@age/capability-kit';
import type { AuthorityPlanTarget } from './authority-plan-target';

/**
 * AuthorityPlanReference — a small, read-only, neutral VALUE shape mirroring the
 * minimal upstream opportunity/plan/decision fields Authority reads (ADR-0017).
 *
 * NOT a backdoor dependency on any producer capability's internals: declared
 * independently in @age/authority-contracts, carries only plain data fields, and
 * is never imported/re-exported from @age/capability-market-discovery,
 * @age/capability-growth, @age/market-discovery-contracts, or
 * @age/growth-contracts. Authority consumes upstream *concepts* through this
 * neutral contract, never a producer package.
 *
 * `referenceType` is a plain string mirror (e.g. 'OPPORTUNITY', 'GROWTH_PLAN').
 * `target` is an AuthorityPlanTarget (an Authority planning target). Its
 * `executionDomains` are upstream/provenance context only — the authoritative
 * execution-domain tags for a plan come from the planning item, not this
 * reference (enforced at the capability layer).
 */
export interface AuthorityPlanReference {
  readonly referenceId: string;
  readonly referenceType: string;
  readonly target: AuthorityPlanTarget;
  readonly executionDomains: readonly ExecutionDomain[];
  /** 0–100, as observed upstream. */
  readonly impactScore: number;
  /** 0–100, as observed upstream. */
  readonly confidenceScore: number;
}
