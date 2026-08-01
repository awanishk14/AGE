import { z } from 'zod';
import {
  discoveryQuestionKindSchema,
  discoverySectionIdSchema,
  evidenceSourceKindSchema,
  offeringKindSchema,
  type DiscoveryQuestionKind,
  type DiscoverySectionId,
  type EvidenceSourceKind,
  type OfferingKind,
} from './enums';

/**
 * Questionnaire layer for Business Discovery.
 *
 * This is a *curated* definition of the AGE discovery questionnaire — a fixed
 * set of sections and questions anchored to the BIF-aligned `DiscoverySectionId`
 * themes and reusing the existing `DiscoveryQuestionKind` answer shapes. It is
 * NOT a generic runtime form builder: there is no field-type registry, no
 * conditional-logic engine, no dynamic composition. Pure data contracts only —
 * no behavior, no persistence, no I/O.
 */

/**
 * Versioned identifier for a questionnaire definition, formatted `YYYY.N` (e.g.
 * `2026.1`). Bumping the version is how the curated question set evolves without
 * silently changing an already-captured profile's meaning.
 */
export type BusinessDiscoveryQuestionnaireVersion = string;

export const businessDiscoveryQuestionnaireVersionSchema = z
  .string()
  .regex(/^\d{4}\.\d+$/, 'version must be formatted YYYY.N');

/**
 * A discovery signal that a required question can be satisfied by, drawn from
 * structured `BusinessDiscoveryProfile` data rather than a free-text answer.
 * This makes "equivalent profile data" explicit and deterministic — validation
 * never *infers* satisfaction, it checks a fixed, curated predicate per signal
 * (see `questionnaire-validation.ts`). A small, closed set by design.
 */
export const PROFILE_SIGNALS = [
  'businessName',
  'industry',
  'businessModel',
  'offerings',
  'segments',
  'geographies',
  'competitors',
  'marketingChannels',
  'goals',
  'constraints',
  'assets',
  'evidenceSources',
  'brandPositioning',
] as const;

export type ProfileSignal = (typeof PROFILE_SIGNALS)[number];

export const profileSignalSchema = z.enum(PROFILE_SIGNALS);

/**
 * BusinessDiscoveryQuestionnaireQuestion — one curated prompt within a
 * questionnaire section. Reuses `DiscoveryQuestionKind` for its answer shape and
 * `DiscoverySectionId` for its section. `critical: true` marks a question whose
 * absence is reported as a *critical* discovery gap (not merely a missing
 * answer). `satisfiedBy` names the structured profile signal that can answer the
 * question without an explicit free-text answer.
 */
export interface BusinessDiscoveryQuestionnaireQuestion {
  readonly id: string;
  readonly sectionId: DiscoverySectionId;
  readonly prompt: string;
  readonly required: boolean;
  readonly critical: boolean;
  readonly kind: DiscoveryQuestionKind;
  readonly choices?: readonly string[];
  readonly satisfiedBy?: ProfileSignal;
  /**
   * ADR-0051 D2/D3 — THE ENUM IS DECLARED ON THE QUESTION, NEVER DERIVED FROM
   * THE ANSWER.
   *
   * `Offering.type` and `EvidenceSourceRef.kind` are required enums that no
   * free-text answer supplies, which is why `buildProfileFromAnswers` refused to
   * populate either collection (ADR-0050 D2). The refusal was correct and the
   * consequence was a profile that could never carry an offering or an evidence
   * source — capping `discoveryConfidenceScore` at 35 however honestly the
   * questionnaire was answered.
   *
   * The fix is here rather than in the mapper: the questionnaire AUTHOR
   * classifies once, at design time, visibly in data ("List the products you
   * sell" carries `entryKind: 'product'`); the OPERATOR transcribes names
   * verbatim; the MAPPER still never inspects prose and still never infers. Two
   * questions may therefore legitimately target the same signal, one per enum
   * value.
   *
   * ⚠️ Meaningful only on a question whose `satisfiedBy` signal routes to a
   * kinded collection. `buildProfileFromAnswers` rejects a questionnaire that
   * pins an `OfferingKind` on an evidence question or vice versa.
   *
   * ⚠️ `'url'` remains a plain reference string that is NEVER fetched. Nothing
   * here authorizes retrieval.
   */
  readonly entryKind?: OfferingKind | EvidenceSourceKind;
}

export const businessDiscoveryQuestionnaireQuestionSchema = z.object({
  id: z.string().min(1),
  sectionId: discoverySectionIdSchema,
  prompt: z.string().min(1),
  required: z.boolean(),
  critical: z.boolean(),
  kind: discoveryQuestionKindSchema,
  choices: z.array(z.string().min(1)).optional(),
  satisfiedBy: profileSignalSchema.optional(),
  entryKind: z.union([offeringKindSchema, evidenceSourceKindSchema]).optional(),
});

/**
 * BusinessDiscoveryQuestionnaireSection — a BIF-aligned grouping of curated
 * questions. Holds no captured answers (that lives on the profile); the
 * questionnaire is the *definition*, the profile is the *capture*.
 */
export interface BusinessDiscoveryQuestionnaireSection {
  readonly id: DiscoverySectionId;
  readonly name: string;
  readonly questions: readonly BusinessDiscoveryQuestionnaireQuestion[];
}

export const businessDiscoveryQuestionnaireSectionSchema = z.object({
  id: discoverySectionIdSchema,
  name: z.string().min(1),
  questions: z.array(businessDiscoveryQuestionnaireQuestionSchema).min(1),
});

/**
 * BusinessDiscoveryQuestionnaire — the top-level curated definition: an
 * identified, versioned, ordered set of sections. Consumers validate a
 * `BusinessDiscoveryProfile` against this definition (see
 * `validateProfileAgainstQuestionnaire`).
 */
export interface BusinessDiscoveryQuestionnaire {
  readonly id: string;
  readonly version: BusinessDiscoveryQuestionnaireVersion;
  readonly name: string;
  readonly sections: readonly BusinessDiscoveryQuestionnaireSection[];
}

export const businessDiscoveryQuestionnaireSchema = z.object({
  id: z.string().min(1),
  version: businessDiscoveryQuestionnaireVersionSchema,
  name: z.string().min(1),
  sections: z.array(businessDiscoveryQuestionnaireSectionSchema).min(1),
});
