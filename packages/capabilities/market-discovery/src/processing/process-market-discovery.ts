import { Capability, CapabilityOutput } from '@age/capability-kit';
import type { ClientContext, ExecutionDomain } from '@age/capability-kit';
import type { MarketDiscoveryInput } from '@age/market-discovery-contracts';
import type { MarketDiscoveryOpportunityItem } from '../market-discovery-opportunity-item';
import type { MarketDiscoveryResult } from '../market-discovery-result';
import type {
  OpportunityProcessingSummary,
  RejectedOpportunityReason,
} from '../opportunity-processing-summary';
import type { MarketOpportunityCandidate } from './market-opportunity-candidate';
import { deriveOpportunities } from './derive-opportunities';
import { validateOpportunity } from './validate-opportunity';
import { deduplicateOpportunities } from './deduplicate-opportunities';
import { scoreOpportunity } from './score-opportunity';

/**
 * processMarketDiscovery — the deterministic Market Discovery pipeline
 * (ADR-0012/0013). Pure function: same inputs always produce the same
 * MarketDiscoveryResult. No persistence, orchestration, or side effects.
 *
 * Pipeline order:
 *  1. Derive one raw candidate per signal.
 *  2. Validate each candidate; each rejected candidate yields exactly one
 *     RejectedOpportunityReason and is dropped from further steps.
 *  3. Structurally deduplicate the survivors; each duplicate yields exactly one
 *     DuplicateOpportunityReference and is dropped from output (its source refs
 *     merge into the accepted original).
 *  4. Score each accepted candidate, producing one MarketDiscoveryOpportunityItem.
 *
 * The output is scoped by ClientContext (authoritative), never by the input.
 * `input.generatedAt` is the only time source (each item's createdAt).
 */
export function processMarketDiscovery(
  context: ClientContext,
  input: MarketDiscoveryInput,
): MarketDiscoveryResult {
  const createdAt = new Date(input.generatedAt);

  // 1–3. Derive, validate, deduplicate.
  const derivedCandidates = deriveOpportunities(input);

  const rejectedReasons: RejectedOpportunityReason[] = [];
  const validCandidates: MarketOpportunityCandidate[] = [];

  for (const candidate of derivedCandidates) {
    const rejection = validateOpportunity(candidate);

    if (rejection) {
      rejectedReasons.push(rejection);
      continue;
    }

    validCandidates.push(candidate);
  }

  const { acceptedCandidates, duplicateReferences } = deduplicateOpportunities(validCandidates);

  // 4. Score + assemble one item per accepted candidate.
  const items: MarketDiscoveryOpportunityItem[] = acceptedCandidates.map((candidate) => {
    const score = scoreOpportunity(candidate);

    return {
      id: candidate.opportunityId,
      capability: Capability.MarketDiscovery,
      createdAt,
      opportunityId: candidate.opportunityId,
      opportunityType: candidate.opportunityType,
      target: candidate.target,
      executionDomains: candidate.executionDomains,
      impactScore: score.impactScore,
      confidenceScore: score.confidenceScore,
      priority: score.priority,
      sourceRefs: candidate.sourceRefs,
    };
  });

  const output = new CapabilityOutput<MarketDiscoveryOpportunityItem>({
    clientId: context.clientId,
    organizationId: context.organizationId,
    capability: Capability.MarketDiscovery,
    executionDomains: unionExecutionDomains(items),
    items,
  });

  const summary: OpportunityProcessingSummary = {
    acceptedCount: acceptedCandidates.length,
    rejectedCount: rejectedReasons.length,
    duplicateCount: duplicateReferences.length,
    rejectedReasons,
    duplicateReferences,
  };

  return { output, summary };
}

/**
 * Deterministic union of the accepted items' execution domains, deduplicated
 * and sorted for stable ordering.
 */
function unionExecutionDomains(
  items: readonly MarketDiscoveryOpportunityItem[],
): ExecutionDomain[] {
  const domains = new Set<ExecutionDomain>();

  for (const item of items) {
    for (const domain of item.executionDomains) {
      domains.add(domain);
    }
  }

  return [...domains].sort();
}
