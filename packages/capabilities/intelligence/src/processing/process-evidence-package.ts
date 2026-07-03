import { Capability, CapabilityOutput } from '@age/capability-kit';
import type { ClientContext } from '@age/capability-kit';
import type { Evidence, EvidencePackage } from '@age/evidence-contracts';
import type { IntelligenceOutputItem } from '../intelligence-output-item';
import type { IntelligenceResult } from '../intelligence-result';
import type {
  DuplicateEvidenceReference,
  IntelligenceProcessingSummary,
  RejectedEvidenceReason,
} from '../processing-summary';
import { validateEvidence } from './validate-evidence';
import { deduplicateEvidence } from './deduplicate-evidence';
import { scoreEvidenceQuality } from './score-evidence-quality';
import { calculateFreshnessDays } from './calculate-freshness';
import { detectContradictions } from './detect-contradictions';

/**
 * processEvidencePackage — the deterministic Intelligence processing pipeline
 * (ADR-0011). Pure function: same inputs always produce the same
 * IntelligenceResult. No persistence, orchestration, or side effects.
 *
 * Pipeline order:
 *  1. Validate every input record. Each rejected record yields exactly one
 *     RejectedEvidenceReason; rejected records are dropped from further steps.
 *  2. Deduplicate the survivors structurally. Each duplicate yields exactly
 *     one DuplicateEvidenceReference; duplicates are dropped from output.
 *  3. Detect contradictions among the accepted (valid, non-duplicate) records.
 *  4. Score quality and compute freshness for each accepted record, producing
 *     one IntelligenceOutputItem per accepted record.
 *
 * The caller-supplied run timestamp is `evidencePackage.generatedAt`; it is
 * used for both freshness and each output item's createdAt so the result is
 * fully deterministic (no internal clock reads in the processing modules).
 */
export function processEvidencePackage(
  context: ClientContext,
  evidencePackage: EvidencePackage,
): IntelligenceResult {
  const runAt = new Date(evidencePackage.generatedAt);

  // 1. Validation.
  const rejectedReasons: RejectedEvidenceReason[] = [];
  const validEvidence: Evidence[] = [];

  for (const evidence of evidencePackage.evidence) {
    const rejection = validateEvidence(evidence);

    if (rejection) {
      rejectedReasons.push(rejection);
      continue;
    }

    validEvidence.push(evidence);
  }

  // 2. Structural deduplication (only over valid evidence).
  const duplicateReferences: readonly DuplicateEvidenceReference[] =
    deduplicateEvidence(validEvidence);
  const duplicateIds = new Set(duplicateReferences.map((reference) => reference.evidenceId));
  const acceptedEvidence = validEvidence.filter((evidence) => !duplicateIds.has(evidence.id));

  // 3. Structural contradiction detection (only over accepted evidence).
  const contradictingIds = detectContradictions(acceptedEvidence);

  // 4. Score + freshness -> one output item per accepted record.
  const items: IntelligenceOutputItem[] = acceptedEvidence.map((evidence) => ({
    id: evidence.id,
    capability: Capability.Intelligence,
    createdAt: runAt,
    evidenceId: evidence.id,
    qualityScore: scoreEvidenceQuality(evidence),
    isContradiction: contradictingIds.has(evidence.id),
    freshnessDays: calculateFreshnessDays(evidence, runAt),
  }));

  const output = new CapabilityOutput<IntelligenceOutputItem>({
    clientId: context.clientId,
    organizationId: context.organizationId,
    capability: Capability.Intelligence,
    executionDomains: [],
    items,
  });

  const summary: IntelligenceProcessingSummary = {
    acceptedCount: acceptedEvidence.length,
    rejectedCount: rejectedReasons.length,
    duplicateCount: duplicateReferences.length,
    contradictionCount: contradictingIds.size,
    rejectedReasons,
    duplicateReferences,
  };

  return { output, summary };
}
