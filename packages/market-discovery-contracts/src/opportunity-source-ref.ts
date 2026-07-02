import type { MarketSignalType } from './enums';

/**
 * MarketOpportunitySourceRef — provenance tying a derived opportunity back to
 * an originating market signal. A single accepted opportunity may carry several
 * of these once structural duplicates are merged into it. Data contract only.
 */
export interface MarketOpportunitySourceRef {
  readonly signalId: string;
  readonly signalType: MarketSignalType;
}
