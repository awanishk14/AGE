import type { CapabilityOutput } from '@age/capability-kit';
import type { IntelligenceOutputItem } from './intelligence-output-item';
import type { ProcessingSummary } from './processing-summary';

/**
 * IntelligenceResult — the capability-specific result wrapper for the
 * Intelligence Capability (ADR-0011). `CapabilityOutput<T>` remains the
 * unmodified generic envelope and carries only accepted, non-duplicate
 * items; `summary` carries the full disposition of everything processed.
 */
export interface IntelligenceResult {
  readonly output: CapabilityOutput<IntelligenceOutputItem>;
  readonly summary: ProcessingSummary;
}
