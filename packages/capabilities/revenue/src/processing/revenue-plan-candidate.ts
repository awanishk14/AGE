import type { ExecutionDomain } from '@age/capability-kit';
import type {
  RevenuePlanSourceRef,
  RevenuePlanTarget,
  RevenuePlanType,
} from '@age/revenue-contracts';

/**
 * RevenuePlanCandidate — an INTERNAL capability type for a derived revenue plan
 * before validation, deduplication, scoring, and assembly (ADR-0019).
 *
 * Not exported from the package root; it is an implementation detail of the
 * processing modules (exported only from src/processing/index.ts for internal
 * tests/modules). It carries only the fields those modules need. The raw scoring
 * inputs (expectedValue/conversionProbability/retentionRisk/estimatedEffort/
 * confidence) live here (not on the public RevenuePlanItem, which carries
 * computed scores). No output envelope.
 *
 * `recommendsProposalDraft`, `monetaryAmount`, and `currency` are carried
 * through as advisory/metadata only — never used in scoring or as duplicate-key
 * components.
 */
export interface RevenuePlanCandidate {
  readonly revenuePlanId: string;
  readonly planType: RevenuePlanType;
  readonly target: RevenuePlanTarget;
  readonly executionDomains: readonly ExecutionDomain[];

  readonly expectedValue: number;
  readonly conversionProbability: number;
  readonly retentionRisk: number;
  readonly estimatedEffort: number;
  readonly confidence: number;

  readonly sourceRefs: readonly RevenuePlanSourceRef[];

  readonly recommendsProposalDraft?: boolean;
  readonly monetaryAmount?: number;
  readonly currency?: string;
}
