/**
 * Small, structural, neutral classification types for Revenue (ADR-0019).
 * String-literal unions — categorization only, never channel or execution
 * logic. Owned here so the capability never imports Market Discovery, Growth,
 * Authority, Operations, SIE, BIF, BKG, or RIE.
 *
 * Revenue meaning is represented through `RevenuePlanType` and
 * `RevenuePlanTargetKind` — never through a new `ExecutionDomain` value (no
 * Sales / Billing / Revenue domain is introduced).
 */

/**
 * Nature of a revenue plan candidate. Caller-provided on the planning input:
 * there is no canonical deterministic upstream -> revenue-plan-type mapping, so
 * Revenue carries planType rather than inventing monetization strategy.
 * Intentionally excludes PROPOSAL_DRAFT (that is an advisory flag, not a plan
 * type — see RevenuePlanningInputItem.recommendsProposalDraft).
 */
export type RevenuePlanType =
  'UPSELL' | 'CROSS_SELL' | 'RENEWAL' | 'EXPANSION' | 'RETENTION' | 'PRICING_PACKAGING';

/**
 * What a revenue plan addresses — a structural planning target identity.
 * Intentionally excludes DEAL (avoids implying a mutable CRM/deal-state handle);
 * CONTRACT / OPPORTUNITY cover the same intent as read-only identities.
 */
export type RevenuePlanTargetKind =
  'ACCOUNT' | 'ENGAGEMENT' | 'CONTRACT' | 'SUBSCRIPTION' | 'OPPORTUNITY';

/** Deterministic priority band (derived from score later, not free-form). */
export type RevenuePlanPriority = 'LOW' | 'MEDIUM' | 'HIGH';

/** Coarse deterministic effort band (derived from effortScore later). */
export type RevenueEffortBand = 'LOW' | 'MEDIUM' | 'HIGH';

/** Coarse deterministic value band (derived from the revenue impact score later). */
export type RevenuePlanValueBand = 'LOW' | 'MEDIUM' | 'HIGH';
