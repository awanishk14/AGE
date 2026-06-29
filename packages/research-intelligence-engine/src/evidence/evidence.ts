import type { EvidenceSource, EvidenceState, SignalType } from '../types/enums';
import type { Metadata } from '../types/common';
import type { ExtractedSignal } from '../signals/extracted-signal';

/** Optional links from a piece of evidence to BIF/BKG entities. */
export interface EvidenceEntityLink {
  readonly organizationId?: string;
  readonly productId?: string;
  readonly competitorId?: string;
  readonly marketId?: string;
}

/**
 * Evidence — the core output of the RIE. AGE reconstructs reality from evidence;
 * it does not interpret the internet. This is a data contract only.
 */
export interface Evidence {
  readonly id: string;
  readonly source: EvidenceSource;
  readonly sourceUrl: string;
  readonly timestamp: string;
  readonly entityLinked: EvidenceEntityLink;
  readonly signalType: SignalType;
  readonly rawContent: string;
  readonly extractedSignals: readonly ExtractedSignal[];
  /** 0–100. */
  readonly confidence: number;
  /** Lifecycle state (Gap 2 hardening). See EvidenceState. */
  readonly state: EvidenceState;
  readonly metadata: Metadata;
}
