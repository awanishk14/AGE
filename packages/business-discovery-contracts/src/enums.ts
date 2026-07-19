import { z } from 'zod';

/**
 * Small, structural classification types for Business Discovery (the intake
 * layer that feeds BIF). String-literal unions — categorization only, never
 * execution, persistence, or channel logic. Zod schemas accompany each so that
 * captured answers can be validated deterministically.
 */

/**
 * Discovery sections, aligned conceptually to BIF themes (organization
 * identity, offerings, ICP, market/competition, brand, channels, goals/
 * constraints, assets, evidence/assumptions). A fixed, curated set — NOT a
 * runtime form-definition engine.
 */
export const DISCOVERY_SECTION_IDS = [
  'business-identity',
  'offerings',
  'customers-icp',
  'market-competition',
  'positioning-brand',
  'channels',
  'goals-constraints',
  'assets',
  'evidence-assumptions',
] as const;

export type DiscoverySectionId = (typeof DISCOVERY_SECTION_IDS)[number];

export const discoverySectionIdSchema = z.enum(DISCOVERY_SECTION_IDS);

/** Answer shape a discovery question expects. */
export const DISCOVERY_QUESTION_KINDS = ['text', 'longText', 'list', 'choice'] as const;

export type DiscoveryQuestionKind = (typeof DISCOVERY_QUESTION_KINDS)[number];

export const discoveryQuestionKindSchema = z.enum(DISCOVERY_QUESTION_KINDS);

/** How an offering is delivered. Not a channel. */
export const OFFERING_KINDS = ['product', 'service'] as const;

export type OfferingKind = (typeof OFFERING_KINDS)[number];

export const offeringKindSchema = z.enum(OFFERING_KINDS);

/** Kind of an evidence source. `url` is a plain reference string, never fetched. */
export const EVIDENCE_SOURCE_KINDS = ['client-statement', 'document', 'url'] as const;

export type EvidenceSourceKind = (typeof EVIDENCE_SOURCE_KINDS)[number];

export const evidenceSourceKindSchema = z.enum(EVIDENCE_SOURCE_KINDS);

/** Time horizon of a business goal. */
export const GOAL_HORIZONS = ['short', 'medium', 'long'] as const;

export type GoalHorizon = (typeof GOAL_HORIZONS)[number];

export const goalHorizonSchema = z.enum(GOAL_HORIZONS);

/** Confidence band attached to a stated assumption. */
export const ASSUMPTION_CONFIDENCE = ['low', 'medium', 'high'] as const;

export type AssumptionConfidence = (typeof ASSUMPTION_CONFIDENCE)[number];

export const assumptionConfidenceSchema = z.enum(ASSUMPTION_CONFIDENCE);

/** Severity of a discovery gap (missing critical information). */
export const GAP_SEVERITIES = ['info', 'important', 'critical'] as const;

export type GapSeverity = (typeof GAP_SEVERITIES)[number];

export const gapSeveritySchema = z.enum(GAP_SEVERITIES);
