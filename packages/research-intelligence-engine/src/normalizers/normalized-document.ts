import type { EvidenceSource } from '../types/enums';
import type { Metadata } from '../types/common';

/** A source document normalized into a common shape before extraction. */
export interface NormalizedDocument {
  readonly source: EvidenceSource;
  readonly title: string;
  readonly content: string;
  readonly author?: string;
  readonly timestamp: string;
  readonly url: string;
  readonly metadata: Metadata;
}
