import { z } from 'zod';
import type { BusinessDiscoveryProfile } from './business-discovery-profile';
import type { ProfileSignal } from './questionnaire';

/**
 * Field-level provenance for Business Discovery.
 *
 * Discovery could previously only cite evidence at *answer* level, via
 * `DiscoveryAnswer.evidenceSourceIds`. But a structured profile field can
 * satisfy a questionnaire question directly through its `satisfiedBy` signal,
 * without any captured answer — and such a field had nowhere to record where its
 * value came from. That is the KNOWN LIMITATION recorded in
 * `completeness-scoring.ts`, and ADR-0025 names it as a prerequisite for
 * Discovery → BIF wiring: the canonical BIF requires provenance per field.
 *
 * REPRESENTATION — a **path-keyed map on the profile**
 * (`BusinessDiscoveryProfile.fieldEvidence`), rather than evidence arrays added
 * to each sub-model. Several evidenceable fields are primitives or string arrays
 * hanging directly off the profile (`industry`, `businessModel`,
 * `brandPositioning`, `geographies`, `marketingChannels`, `constraints`,
 * `assets`) — there is no object on them to carry a reference, so a per-model
 * field could not express their provenance at all. One optional map covers every
 * case, leaves all existing types untouched, and keeps profiles that do not use
 * it exactly as valid as before.
 *
 * Pure data contracts plus one pure validator. No behavior, no persistence, no
 * I/O, no wall-clock. Evidence locators remain plain references and are never
 * fetched. Provenance is entirely **optional** — omitting it is valid, and a
 * field never claims evidence it does not have.
 */

/**
 * The closed set of profile fields that may carry evidence.
 *
 * Curated deliberately, not derived from the type: it covers the structured
 * fields that can satisfy a questionnaire signal, and excludes fields where a
 * citation would be meaningless — `evidenceSources` (self-referential),
 * `assumptions` (unverified by definition), `gaps` (records of absence) and
 * `sections` (whose answers already carry answer-level evidence).
 *
 * Field-level only. Item-level paths (e.g. a single offering) are intentionally
 * out of scope: index-based paths break under reordering, and nothing needs that
 * granularity yet.
 */
export const EVIDENCEABLE_FIELD_PATHS = [
  'businessName',
  'industry',
  'businessModel',
  'brandPositioning',
  'geographies',
  'marketingChannels',
  'segments',
  'offerings',
  'competitors',
  'goals',
  'constraints',
  'assets',
] as const;

export type EvidenceableFieldPath = (typeof EVIDENCEABLE_FIELD_PATHS)[number];

export const evidenceableFieldPathSchema = z.enum(EVIDENCEABLE_FIELD_PATHS);

/**
 * BusinessDiscoveryFieldEvidence — evidence source ids cited per profile field.
 *
 * A map rather than a list: duplicate paths are structurally impossible, so the
 * "duplicate field path" failure mode cannot occur. Keys are constrained to
 * `EvidenceableFieldPath`, so malformed paths are a schema error rather than a
 * validation finding. Each entry must cite at least one source — an empty
 * citation list asserts nothing and is rejected.
 *
 * Referential integrity (do these ids exist in `profile.evidenceSources`?)
 * cannot be expressed here, because the schema for one field cannot see the rest
 * of the profile. Use `validateBusinessDiscoveryFieldEvidence` for that.
 */
export type BusinessDiscoveryFieldEvidence = Readonly<
  Partial<Record<EvidenceableFieldPath, readonly string[]>>
>;

export const businessDiscoveryFieldEvidenceSchema = z.record(
  evidenceableFieldPathSchema,
  z.array(z.string().min(1)).min(1, 'a field evidence entry must cite at least one source'),
);

/**
 * Which profile field backs each questionnaire `ProfileSignal`. Lets scoring ask
 * "is the field that satisfies this question evidenced?" without duplicating the
 * signal vocabulary.
 *
 * `evidenceSources` is deliberately absent: the evidence list citing itself
 * would be circular.
 */
export const PROFILE_SIGNAL_TO_FIELD_PATH: Readonly<
  Partial<Record<ProfileSignal, EvidenceableFieldPath>>
> = {
  businessName: 'businessName',
  industry: 'industry',
  businessModel: 'businessModel',
  brandPositioning: 'brandPositioning',
  geographies: 'geographies',
  marketingChannels: 'marketingChannels',
  segments: 'segments',
  offerings: 'offerings',
  competitors: 'competitors',
  goals: 'goals',
  constraints: 'constraints',
  assets: 'assets',
};

/** One field-level citation that names an evidence source the profile does not declare. */
export interface DanglingFieldEvidenceReference {
  readonly fieldPath: EvidenceableFieldPath;
  readonly evidenceSourceId: string;
}

/** One answer-level citation that names an evidence source the profile does not declare. */
export interface DanglingAnswerEvidenceReference {
  readonly questionId: string;
  readonly evidenceSourceId: string;
}

/**
 * Outcome of checking every evidence citation in a profile against the evidence
 * sources it actually declares. Reports findings; never throws, never mutates.
 */
export interface BusinessDiscoveryFieldEvidenceValidation {
  readonly valid: boolean;
  readonly danglingFieldEvidence: readonly DanglingFieldEvidenceReference[];
  readonly danglingAnswerEvidence: readonly DanglingAnswerEvidenceReference[];
  /** Paths present with an empty citation list. The schema rejects these, but the
   *  validator is usable on unparsed input, so it reports them too. */
  readonly emptyFieldEvidencePaths: readonly EvidenceableFieldPath[];
}

export const danglingFieldEvidenceReferenceSchema = z.object({
  fieldPath: evidenceableFieldPathSchema,
  evidenceSourceId: z.string().min(1),
});

export const danglingAnswerEvidenceReferenceSchema = z.object({
  questionId: z.string().min(1),
  evidenceSourceId: z.string().min(1),
});

export const businessDiscoveryFieldEvidenceValidationSchema = z.object({
  valid: z.boolean(),
  danglingFieldEvidence: z.array(danglingFieldEvidenceReferenceSchema),
  danglingAnswerEvidence: z.array(danglingAnswerEvidenceReferenceSchema),
  emptyFieldEvidencePaths: z.array(evidenceableFieldPathSchema),
});

/**
 * validateBusinessDiscoveryFieldEvidence — pure referential-integrity check for
 * every evidence citation in a profile.
 *
 * A field must never claim evidence that does not exist, so this reports any
 * citation — field-level or answer-level — naming an id absent from
 * `profile.evidenceSources`, plus any field entry citing nothing at all.
 * Deterministic: findings are emitted in declaration order
 * (`EVIDENCEABLE_FIELD_PATHS`, then profile section/answer order). The input is
 * never mutated and no I/O is performed.
 */
export function validateBusinessDiscoveryFieldEvidence(
  profile: BusinessDiscoveryProfile,
): BusinessDiscoveryFieldEvidenceValidation {
  const declaredSourceIds = new Set(profile.evidenceSources.map((source) => source.id));

  const danglingFieldEvidence: DanglingFieldEvidenceReference[] = [];
  const emptyFieldEvidencePaths: EvidenceableFieldPath[] = [];

  const fieldEvidence = profile.fieldEvidence;
  if (fieldEvidence !== undefined) {
    for (const fieldPath of EVIDENCEABLE_FIELD_PATHS) {
      const citedIds = fieldEvidence[fieldPath];
      if (citedIds === undefined) {
        continue;
      }
      if (citedIds.length === 0) {
        emptyFieldEvidencePaths.push(fieldPath);
        continue;
      }
      for (const evidenceSourceId of citedIds) {
        if (!declaredSourceIds.has(evidenceSourceId)) {
          danglingFieldEvidence.push({ fieldPath, evidenceSourceId });
        }
      }
    }
  }

  const danglingAnswerEvidence: DanglingAnswerEvidenceReference[] = [];
  for (const section of profile.sections) {
    for (const answer of section.answers) {
      for (const evidenceSourceId of answer.evidenceSourceIds ?? []) {
        if (!declaredSourceIds.has(evidenceSourceId)) {
          danglingAnswerEvidence.push({ questionId: answer.questionId, evidenceSourceId });
        }
      }
    }
  }

  return {
    valid:
      danglingFieldEvidence.length === 0 &&
      danglingAnswerEvidence.length === 0 &&
      emptyFieldEvidencePaths.length === 0,
    danglingFieldEvidence,
    danglingAnswerEvidence,
    emptyFieldEvidencePaths,
  };
}

/**
 * The field paths whose citations are **all** resolvable against the profile's
 * declared evidence sources. Only these may count as evidence anywhere —
 * a dangling citation earns nothing.
 */
export function getEvidencedFieldPaths(
  profile: BusinessDiscoveryProfile,
): readonly EvidenceableFieldPath[] {
  const declaredSourceIds = new Set(profile.evidenceSources.map((source) => source.id));
  const fieldEvidence = profile.fieldEvidence;
  if (fieldEvidence === undefined) {
    return [];
  }

  return EVIDENCEABLE_FIELD_PATHS.filter((fieldPath) => {
    const citedIds = fieldEvidence[fieldPath];
    return (
      citedIds !== undefined &&
      citedIds.length > 0 &&
      citedIds.every((id) => declaredSourceIds.has(id))
    );
  });
}
