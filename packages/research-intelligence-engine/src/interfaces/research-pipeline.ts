import type { EvidenceSource } from '../types/enums';
import type { BIFMapping } from '../mapping/bif-mapping';

/** A request to the RIE. */
export interface ResearchQuery {
  readonly query: string;
  readonly sources?: readonly EvidenceSource[];
  readonly organizationId?: string;
}

/**
 * ResearchPipeline — orchestrates the full RIE flow and returns BIF proposals.
 * Interface only; no implementation.
 */
export interface ResearchPipeline {
  run(query: ResearchQuery): Promise<readonly BIFMapping[]>;
}
