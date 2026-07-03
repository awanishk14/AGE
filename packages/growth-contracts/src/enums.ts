/**
 * Small, structural, neutral classification types for Growth (ADR-0014).
 * String-literal unions — categorization only, never channel or execution
 * logic. Owned here so the capability never imports Market Discovery, SIE, BIF,
 * BKG, or RIE.
 */

/**
 * Nature of a growth plan candidate. Caller-provided on the planning input
 * (ADR-0015 field proposal): there is no canonical deterministic
 * opportunity-type -> plan-type mapping, so Growth carries planType rather than
 * inventing product strategy. These are strategic categories, not channels.
 */
export type GrowthPlanType =
  'PAID_ACQUISITION' | 'CONVERSION_OPTIMIZATION' | 'LANDING_EXPERIENCE' | 'CONTENT_DISTRIBUTION';

/** What a growth plan addresses — a structural planning target identity. */
export type GrowthPlanTargetKind = 'OPPORTUNITY' | 'FUNNEL_STAGE' | 'AUDIENCE' | 'PAGE';

/** Deterministic priority band (derived from score, not free-form). */
export type GrowthPlanPriority = 'LOW' | 'MEDIUM' | 'HIGH';

/** Coarse deterministic effort band (derived from effortScore). */
export type GrowthEffortBand = 'LOW' | 'MEDIUM' | 'HIGH';
