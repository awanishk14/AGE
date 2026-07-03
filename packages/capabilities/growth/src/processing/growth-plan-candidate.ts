import type { ExecutionDomain } from '@age/capability-kit';
import type { GrowthPlanSourceRef, GrowthPlanTarget, GrowthPlanType } from '@age/growth-contracts';

/**
 * GrowthPlanCandidate — an INTERNAL capability type for a derived growth plan
 * before validation, deduplication, scoring, and assembly.
 *
 * Not exported from the package root; it is an implementation detail of the
 * processing modules. It carries only the fields those modules need. The raw
 * scoring inputs (expectedImpact/confidence/estimatedEffort) live here (not on
 * the public GrowthPlanItem, which carries computed scores).
 */
export interface GrowthPlanCandidate {
  readonly planId: string;
  readonly planType: GrowthPlanType;
  readonly target: GrowthPlanTarget;
  readonly executionDomains: readonly ExecutionDomain[];
  readonly expectedImpact: number;
  readonly confidence: number;
  readonly estimatedEffort: number;
  readonly sourceRefs: readonly GrowthPlanSourceRef[];
}
