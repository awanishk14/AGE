import type { BIFFieldRef } from '@age/bif';

/**
 * StrategyContext — the read-only inputs the SIE consumes.
 *
 * The SIE consumes BIF, RIE and BKG by reference only and NEVER writes to them.
 * Evidence and knowledge nodes are referenced by id; BIF fields by BIFFieldRef.
 */
export interface StrategyContext {
  readonly organizationId: string;
  readonly bifId: string;
  readonly evidenceIds: readonly string[];
  readonly knowledgeNodeIds: readonly string[];
  readonly focusFields?: readonly BIFFieldRef[];
}
