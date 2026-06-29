/** External evidence sources the RIE can sense. */
export enum EvidenceSource {
  REDDIT = 'REDDIT',
  G2 = 'G2',
  CAPTERRA = 'CAPTERRA',
  TRUSTPILOT = 'TRUSTPILOT',
  YOUTUBE = 'YOUTUBE',
  GOOGLE_SEARCH = 'GOOGLE_SEARCH',
  COMPETITOR_SITE = 'COMPETITOR_SITE',
  ADS = 'ADS',
  SOCIAL = 'SOCIAL',
  JOB_POSTING = 'JOB_POSTING',
  GITHUB = 'GITHUB',
  FORUM = 'FORUM',
}

/** The kind of signal a piece of evidence carries. */
export enum SignalType {
  PAIN_POINT = 'PAIN_POINT',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  INTENT = 'INTENT',
  COMPLAINT = 'COMPLAINT',
  PRAISE = 'PRAISE',
  PRICING_SIGNAL = 'PRICING_SIGNAL',
  COMPETITOR_MENTION = 'COMPETITOR_MENTION',
  MARKET_TREND = 'MARKET_TREND',
  BUYING_SIGNAL = 'BUYING_SIGNAL',
  TECH_STACK_SIGNAL = 'TECH_STACK_SIGNAL',
}

/** Sentiment / direction of an extracted signal. */
export enum Polarity {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
  NEUTRAL = 'NEUTRAL',
}

/** The action a BIF mapping proposal recommends. RIE proposes; it never applies. */
export enum BIFMappingAction {
  PROPOSE_UPDATE = 'PROPOSE_UPDATE',
  INCREASE_CONFIDENCE = 'INCREASE_CONFIDENCE',
  FLAG_CONFLICT = 'FLAG_CONFLICT',
  ADD_DERIVED_VALUE = 'ADD_DERIVED_VALUE',
}

/** Severity of a detected evidence conflict. */
export enum ConflictSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/**
 * EvidenceState — the lifecycle of a piece of evidence (Gap 2 hardening).
 *
 * Contract rules (enforced by future engines, not by this package):
 *  - Transitions follow the primary order NEW → PROCESSED → MAPPED → APPLIED_TO_BIF.
 *  - States cannot be skipped (no direct jump to APPLIED_TO_BIF without MAPPED).
 *  - REJECTED and CONFLICTED are terminal off-ramps and can never reach APPLIED_TO_BIF.
 */
export enum EvidenceState {
  NEW = 'NEW',
  PROCESSED = 'PROCESSED',
  MAPPED = 'MAPPED',
  APPLIED_TO_BIF = 'APPLIED_TO_BIF',
  REJECTED = 'REJECTED',
  CONFLICTED = 'CONFLICTED',
}
