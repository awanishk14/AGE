/**
 * Small, structural, neutral classification types for Market Discovery
 * (ADR-0012). String-literal unions — categorization only, never channel or
 * execution logic. Owned here so the capability never imports SIE/BIF/BKG/RIE.
 */

/** Why-kind of a market signal. */
export type MarketSignalType =
  | 'KEYWORD_GAP'
  | 'COMPETITOR_WEAKNESS'
  | 'UNMET_DEMAND'
  | 'RISING_TREND'
  | 'CONTENT_GAP'
  | 'LOCAL_VISIBILITY_GAP'
  | 'CONVERSION_FRICTION';

/** What a market signal is about — a structural target identity. */
export type MarketSignalTargetKind = 'KEYWORD' | 'COMPETITOR' | 'TOPIC' | 'LOCATION' | 'SEGMENT';

/** Nature of a derived opportunity. Not a channel. */
export type OpportunityType =
  | 'VISIBILITY'
  | 'DEMAND_CAPTURE'
  | 'COMPETITIVE_DISPLACEMENT'
  | 'CONTENT'
  | 'LOCAL_PRESENCE'
  | 'CONVERSION';

/** Deterministic priority band (derived from score, not free-form). */
export type OpportunityPriority = 'LOW' | 'MEDIUM' | 'HIGH';
