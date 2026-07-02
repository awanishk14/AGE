import { Capability, CapabilityOutput } from '@age/capability-kit';
import type { ClientContext } from '@age/capability-kit';
import type { EvidencePackage } from '@age/evidence-contracts';
import type { IntelligenceOutputItem } from './intelligence-output-item';
import type { IntelligenceResult } from './intelligence-result';

/**
 * IntelligenceCapability — validates, deduplicates, and scores RIE evidence
 * before it is written into the BIF as business truth.
 *
 * Pure producer: reads an EvidencePackage, produces an IntelligenceResult.
 * Never writes to the BIF directly. Never performs side effects. Depends
 * only on @age/evidence-contracts for evidence types (ADR-0010) — never on
 * @age/research-intelligence-engine directly.
 * (CAPABILITY_ARCHITECTURE §3, §4, §8)
 *
 * Contract scaffold only (T10). Deterministic processing modules
 * (validation, deduplication, quality scoring, contradiction detection,
 * freshness calculation) land in T11; pipeline wiring lands in T12.
 */
export class IntelligenceCapability {
  async run(
    context: ClientContext,
    _evidencePackage: EvidencePackage,
  ): Promise<IntelligenceResult> {
    const output = new CapabilityOutput<IntelligenceOutputItem>({
      clientId: context.clientId,
      organizationId: context.organizationId,
      capability: Capability.Intelligence,
      executionDomains: [],
      items: [],
    });

    return {
      output,
      summary: {
        acceptedCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        contradictionCount: 0,
        rejectedReasons: [],
        duplicateReferences: [],
      },
    };
  }
}
