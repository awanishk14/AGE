import type { CapabilityOutputItem } from '@age/capability-kit';

/**
 * IntelligenceOutputItem — a single validated evidence record produced by
 * the Intelligence Capability.
 *
 * The Intelligence Capability sits between RIE and BIF: it validates,
 * deduplicates, and scores evidence quality before it becomes business truth.
 * (CAPABILITY_ARCHITECTURE §3)
 */
export interface IntelligenceOutputItem extends CapabilityOutputItem {
  readonly evidenceId: string;
  readonly qualityScore: number;
  readonly isContradiction: boolean;
  readonly freshnessDays: number;
}
