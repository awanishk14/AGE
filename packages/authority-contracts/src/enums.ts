/**
 * Small, structural, neutral classification types for Authority (ADR-0017).
 * String-literal unions — categorization only, never channel or execution
 * logic. Owned here so the capability never imports Market Discovery, Growth,
 * SIE, BIF, BKG, or RIE.
 */

/**
 * Nature of an authority plan candidate. Caller-provided on the planning input:
 * there is no canonical deterministic upstream -> authority-plan-type mapping,
 * so Authority carries planType rather than inventing product strategy. Faithful
 * to CAPABILITY_ARCHITECTURE §7 authority plays; VIDEO and PODCAST stay distinct.
 */
export type AuthorityPlanType =
  | 'CONTENT_STRATEGY'
  | 'THOUGHT_LEADERSHIP'
  | 'DIGITAL_PR'
  | 'BACKLINK'
  | 'REVIEW'
  | 'VIDEO'
  | 'PODCAST';

/** What an authority plan addresses — a structural planning target identity. */
export type AuthorityPlanTargetKind = 'OPPORTUNITY' | 'TOPIC' | 'AUDIENCE' | 'ENTITY';

/** Deterministic priority band (derived from score, not free-form). */
export type AuthorityPlanPriority = 'LOW' | 'MEDIUM' | 'HIGH';

/** Coarse deterministic effort band (derived from effortScore). */
export type AuthorityEffortBand = 'LOW' | 'MEDIUM' | 'HIGH';
