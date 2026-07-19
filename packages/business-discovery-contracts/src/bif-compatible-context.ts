import { z } from 'zod';
import { customerSegmentSchema, type CustomerSegment } from './customer-segment';
import { offeringSchema, type Offering } from './offering';
import { competitorReferenceSchema, type CompetitorReference } from './competitor-reference';
import { businessGoalSchema, type BusinessGoal } from './business-goal';
import { evidenceSourceRefSchema, type EvidenceSourceRef } from './evidence-source-ref';
import { businessAssumptionSchema, type BusinessAssumption } from './business-assumption';
import { discoveryGapSchema, type DiscoveryGap } from './discovery-gap';

/**
 * BIF-compatible projection of a Business Discovery profile.
 *
 * BOUNDARY NOTE — this is a *local* output shape, intentionally NOT imported
 * from `@age/bif`. The canonical `BusinessIntelligenceFramework` root requires
 * wall-clock `Date`s, per-field source/confidence metadata and 0–100
 * confidence/completeness scores. Producing those from intake data would force
 * fabricated scoring and non-deterministic construction — both out of scope for
 * this slice. Instead we emit a normalized, deterministic context whose grouping
 * keys mirror `@age/bif`'s `SectionType` string values (see
 * `BIF_COMPATIBLE_SECTION_KEYS`), so it is BIF-*compatible* and ready to feed a
 * future BIF-wiring slice, without depending on or mutating the BIF package.
 */

/**
 * Grouping keys for the projection. Values mirror the relevant subset of
 * `@age/bif` `SectionType` enum string values exactly (`organization_identity`,
 * `products_services`, `icp_personas`, `market_competition`, `brand_system`,
 * `gtm_system`, `assets`, `constraints`) so downstream BIF wiring can align by
 * key. Kept as a local constant to avoid a package dependency / coupling.
 */
export const BIF_COMPATIBLE_SECTION_KEYS = {
  organizationIdentity: 'organization_identity',
  productsServices: 'products_services',
  icpPersonas: 'icp_personas',
  marketCompetition: 'market_competition',
  brandSystem: 'brand_system',
  gtmSystem: 'gtm_system',
  assets: 'assets',
  constraints: 'constraints',
} as const;

export type BifCompatibleSectionKey =
  (typeof BIF_COMPATIBLE_SECTION_KEYS)[keyof typeof BIF_COMPATIBLE_SECTION_KEYS];

/** Organization identity slice of the projection. */
export interface BifOrganizationIdentity {
  readonly name: string;
  readonly industry?: string;
  readonly businessModel?: string;
  readonly brandPositioning?: string;
}

export const bifOrganizationIdentitySchema = z.object({
  name: z.string().min(1),
  industry: z.string().min(1).optional(),
  businessModel: z.string().min(1).optional(),
  brandPositioning: z.string().min(1).optional(),
});

/** Market & competition slice of the projection. */
export interface BifMarketCompetition {
  readonly geographies: readonly string[];
  readonly competitors: readonly CompetitorReference[];
}

export const bifMarketCompetitionSchema = z.object({
  geographies: z.array(z.string().min(1)),
  competitors: z.array(competitorReferenceSchema),
});

/**
 * BifCompatibleBusinessContext — the normalized, BIF-aligned business context
 * projected from a `BusinessDiscoveryProfile`. Pure data; element shapes reuse
 * the discovery contract sub-models directly. `sourceProfileId` and `capturedAt`
 * are carried through verbatim to preserve traceability and determinism.
 */
export interface BifCompatibleBusinessContext {
  readonly sourceProfileId: string;
  readonly capturedAt: string;
  readonly organizationIdentity: BifOrganizationIdentity;
  readonly customerSegments: readonly CustomerSegment[];
  readonly offerings: readonly Offering[];
  readonly marketCompetition: BifMarketCompetition;
  readonly marketingChannels: readonly string[];
  readonly goals: readonly BusinessGoal[];
  readonly constraints: readonly string[];
  readonly assets: readonly string[];
  readonly evidenceSources: readonly EvidenceSourceRef[];
  readonly assumptions: readonly BusinessAssumption[];
  readonly gaps: readonly DiscoveryGap[];
}

export const bifCompatibleBusinessContextSchema = z.object({
  sourceProfileId: z.string().min(1),
  capturedAt: z.string().datetime(),
  organizationIdentity: bifOrganizationIdentitySchema,
  customerSegments: z.array(customerSegmentSchema),
  offerings: z.array(offeringSchema),
  marketCompetition: bifMarketCompetitionSchema,
  marketingChannels: z.array(z.string().min(1)),
  goals: z.array(businessGoalSchema),
  constraints: z.array(z.string().min(1)),
  assets: z.array(z.string().min(1)),
  evidenceSources: z.array(evidenceSourceRefSchema),
  assumptions: z.array(businessAssumptionSchema),
  gaps: z.array(discoveryGapSchema),
});
