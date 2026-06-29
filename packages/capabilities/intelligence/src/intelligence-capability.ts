import { Capability, CapabilityOutput } from '@age/capability-kit';
import type { ClientContext } from '@age/capability-kit';
import type { IntelligenceOutputItem } from './intelligence-output-item';

/**
 * IntelligenceCapability — validates, deduplicates, and scores RIE evidence
 * before it is written into the BIF as business truth.
 *
 * Pure producer: reads evidence, produces a ValidatedEvidenceSet.
 * Never writes to the BIF directly. Never performs side effects.
 * (CAPABILITY_ARCHITECTURE §3, §4, §8)
 *
 * Scaffold only. Full implementation follows in subsequent EPIC-01 tasks.
 */
export class IntelligenceCapability {
  async run(context: ClientContext): Promise<CapabilityOutput<IntelligenceOutputItem>> {
    return new CapabilityOutput<IntelligenceOutputItem>({
      clientId: context.clientId,
      organizationId: context.organizationId,
      capability: Capability.Intelligence,
      executionDomains: [],
      items: [],
    });
  }
}
