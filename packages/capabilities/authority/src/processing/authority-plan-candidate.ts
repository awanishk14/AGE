import type { ExecutionDomain } from '@age/capability-kit';
import type {
  AuthorityPlanSourceRef,
  AuthorityPlanTarget,
  AuthorityPlanType,
} from '@age/authority-contracts';

/**
 * AuthorityPlanCandidate — an INTERNAL capability type for a derived authority
 * plan before validation, deduplication, scoring, and assembly.
 *
 * Not exported from the package root; it is an implementation detail of the
 * processing modules. It carries only the fields those modules need. The raw
 * scoring inputs (expectedImpact/confidence/estimatedEffort) live here (not on
 * the public AuthorityPlanItem, which carries computed scores).
 */
export interface AuthorityPlanCandidate {
  readonly authorityPlanId: string;
  readonly planType: AuthorityPlanType;
  readonly target: AuthorityPlanTarget;
  readonly executionDomains: readonly ExecutionDomain[];
  readonly expectedImpact: number;
  readonly confidence: number;
  readonly estimatedEffort: number;
  readonly sourceRefs: readonly AuthorityPlanSourceRef[];
}
