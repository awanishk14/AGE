import type { Evidence } from './evidence';

/**
 * EvidencePackage — a batch of Evidence produced by an evidence producer
 * (e.g. the Research Intelligence Engine) for a single client/organization,
 * handed to an evidence consumer (e.g. the Intelligence Capability) for
 * processing. Data contract only — no behavior.
 */
export interface EvidencePackage {
  readonly clientId: string;
  readonly organizationId: string;
  readonly evidence: readonly Evidence[];
  readonly generatedAt: string;
}
