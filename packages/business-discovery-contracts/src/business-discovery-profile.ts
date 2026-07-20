import { z } from 'zod';
import { discoverySectionSchema, type DiscoverySection } from './discovery-section';
import { customerSegmentSchema, type CustomerSegment } from './customer-segment';
import { offeringSchema, type Offering } from './offering';
import { competitorReferenceSchema, type CompetitorReference } from './competitor-reference';
import { businessGoalSchema, type BusinessGoal } from './business-goal';
import { evidenceSourceRefSchema, type EvidenceSourceRef } from './evidence-source-ref';
import { businessAssumptionSchema, type BusinessAssumption } from './business-assumption';
import { discoveryGapSchema, type DiscoveryGap } from './discovery-gap';
import {
  businessDiscoveryFieldEvidenceSchema,
  type BusinessDiscoveryFieldEvidence,
} from './field-provenance';

/**
 * BusinessDiscoveryProfile — the aggregate produced by Business Discovery: a
 * validated, machine-usable snapshot of a single business's captured context.
 *
 * Pure data contract only — no behavior, no persistence, no I/O. `capturedAt` is
 * an input-derived ISO timestamp (caller-supplied, no wall-clock read) to keep
 * construction deterministic, matching the codebase convention.
 *
 * Required core fields are `id` and `businessName`; everything else is optional
 * or a (possibly empty) list, so a partial early-stage profile is still valid
 * and its missing information can be represented as `gaps`.
 */
export interface BusinessDiscoveryProfile {
  readonly id: string;
  readonly businessName: string;
  readonly industry?: string;
  readonly businessModel?: string;
  readonly geographies: readonly string[];
  readonly marketingChannels: readonly string[];
  readonly brandPositioning?: string;

  readonly sections: readonly DiscoverySection[];
  readonly segments: readonly CustomerSegment[];
  readonly offerings: readonly Offering[];
  readonly competitors: readonly CompetitorReference[];
  readonly goals: readonly BusinessGoal[];
  readonly constraints: readonly string[];
  readonly assets: readonly string[];

  readonly evidenceSources: readonly EvidenceSourceRef[];
  readonly assumptions: readonly BusinessAssumption[];
  readonly gaps: readonly DiscoveryGap[];

  /**
   * Optional field-level provenance: evidence source ids cited per structured
   * field. Omitting it is valid — a profile that cites nothing here is exactly
   * as valid as before this field existed. Referential integrity against
   * `evidenceSources` is checked by `validateBusinessDiscoveryFieldEvidence`,
   * which a schema cannot do from within one field.
   */
  readonly fieldEvidence?: BusinessDiscoveryFieldEvidence;

  readonly capturedAt: string;
}

export const businessDiscoveryProfileSchema = z.object({
  id: z.string().min(1),
  businessName: z.string().min(1),
  industry: z.string().min(1).optional(),
  businessModel: z.string().min(1).optional(),
  geographies: z.array(z.string().min(1)),
  marketingChannels: z.array(z.string().min(1)),
  brandPositioning: z.string().min(1).optional(),

  sections: z.array(discoverySectionSchema),
  segments: z.array(customerSegmentSchema),
  offerings: z.array(offeringSchema),
  competitors: z.array(competitorReferenceSchema),
  goals: z.array(businessGoalSchema),
  constraints: z.array(z.string().min(1)),
  assets: z.array(z.string().min(1)),

  evidenceSources: z.array(evidenceSourceRefSchema),
  assumptions: z.array(businessAssumptionSchema),
  gaps: z.array(discoveryGapSchema),

  fieldEvidence: businessDiscoveryFieldEvidenceSchema.optional(),

  capturedAt: z.string().datetime(),
});
