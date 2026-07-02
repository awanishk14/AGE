/** External evidence sources sensed by evidence producers (e.g. the RIE). */
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

/**
 * EvidenceState — the lifecycle of a piece of evidence (Gap 2 hardening).
 *
 * Contract rules (enforced by engines that consume this contract, not by this package):
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

/** Sentiment / direction of an extracted signal. */
export enum Polarity {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
  NEUTRAL = 'NEUTRAL',
}
