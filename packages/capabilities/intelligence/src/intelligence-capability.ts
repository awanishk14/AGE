import type { ClientContext } from '@age/capability-kit';
import type { EvidencePackage } from '@age/evidence-contracts';
import type { IntelligenceResult } from './intelligence-result';
import { processEvidencePackage } from './processing/process-evidence-package';

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
 * The full deterministic processing pipeline (validation, structural
 * deduplication, contradiction detection, quality scoring, freshness) lives
 * in processEvidencePackage (T12).
 */
export class IntelligenceCapability {
  async run(context: ClientContext, evidencePackage: EvidencePackage): Promise<IntelligenceResult> {
    return processEvidencePackage(context, evidencePackage);
  }
}
