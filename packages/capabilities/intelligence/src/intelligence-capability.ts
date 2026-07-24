import type { ClientContext } from '@age/capability-kit';
import type { EvidencePackage } from '@age/evidence-contracts';
import type { ScoredBifContext } from '@age/business-discovery-contracts';
import type { IntelligenceResult } from './intelligence-result';
import type { BusinessContextAssessmentResult } from './business-context-assessment-result';
import { processEvidencePackage } from './processing/process-evidence-package';
import {
  assessScoredBifContext,
  type AssessScoredBifContextOptions,
} from './processing/assess-scored-bif-context';

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

  /**
   * Assess a caller-assembled `ScoredBifContext` (ADR-0026, Decision 5).
   *
   * Read-only and deterministic: reports which sections carry context strong
   * enough to rely on, states the limits of the rest, and carries a first-class
   * sufficiency state. Depends only on the neutral projection contract — never on
   * `@age/bif` — and generates no strategy. `producedAt` is caller-supplied
   * (Decision 2); nothing here reads the wall clock.
   */
  assessBusinessContext(
    context: ClientContext,
    scoredBifContext: ScoredBifContext,
    options: AssessScoredBifContextOptions,
  ): BusinessContextAssessmentResult {
    return assessScoredBifContext(context, scoredBifContext, options);
  }
}
