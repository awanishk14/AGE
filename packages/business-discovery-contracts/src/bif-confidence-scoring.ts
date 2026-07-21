import { z } from 'zod';
import {
  BIF_SECTIONS,
  BIFStatus,
  FieldConfidence,
  FieldSource,
  SectionType,
  type BIFField,
  type BIFSection,
  type BIFSectionDefinition,
  type BusinessIntelligenceFramework,
} from '@age/bif';

/**
 * BIF scoring layer — ADR-0025 Decision 3 follow-up (slice 3).
 *
 * Computes BIF **confidence** honestly from the BIF itself, replacing the
 * provisional constant the Discovery → BIF mapper emits
 * (`PROVISIONAL_BIF_CONFIDENCE_SCORE`, slice 2 / PR #75).
 *
 * WHAT BIF CONFIDENCE MEANS. Trust in the produced business *intelligence*:
 * how much of the canonical framework is populated, and how well-evidenced the
 * populated part is. It is **not** discovery input confidence.
 * `discoveryConfidenceScore` measures how well-sourced the *intake* was, and
 * ADR-0025 forbids copying it into any BIF confidence field — directly or as an
 * input term. This module makes that structurally impossible: it accepts only a
 * `BusinessIntelligenceFramework`, never discovery metadata, so no discovery
 * score is in scope to copy.
 *
 * PRESENCE IS NOT TRUST, AND TRUST IS NOT COVERAGE. A section with one of nine
 * fields populated, all user-confirmed, is truthful about that one field but is
 * still weak *as intelligence* — most of the section is missing. So every score
 * combines two independent factors:
 *
 * - **trust** — provenance and confidence of the fields that *are* populated;
 * - **coverage** — how much of what BIF defines is populated at all.
 *
 * They are combined with a geometric mean, so neither can mask the other: a
 * perfectly evidenced 1-of-9 section cannot score high, and a fully populated
 * but wholly unevidenced section cannot either. The model is deliberately
 * conservative — a sparse Draft BIF must not score high.
 *
 * DETERMINISM. Pure arithmetic over the input BIF. No wall-clock (`Date.now`,
 * `new Date`, `performance.now`), no randomness, no I/O, no network, no AI/LLM,
 * no environment reads. Identical input always yields an identical result.
 * Inputs are never mutated: a new BIF (with new section objects) is returned and
 * the original is left untouched. No `Date` on the BIF is rewritten — scoring
 * derives a number from existing content, it does not edit content, so it has no
 * timestamp to invent and needs none.
 *
 * BOUNDARIES. `@age/bif` is consumed, never modified: no BIF type, schema or
 * enum is changed or extended, no new enum value is invented, no `AI_INFERRED`
 * is emitted (this module reads confidence, it never assigns it), no section is
 * created — omitted sections stay omitted and are never placeholder-filled — and
 * `status` is passed through unchanged, so scoring can never promote a BIF out
 * of `Draft`. Promotion rules are a separate, undecided concern.
 */

/**
 * Scoring model version. Bump when weights, caps or rules change, so a stored
 * score can be traced to the model that produced it. Not a timestamp —
 * deliberately no wall-clock anywhere in this module.
 */
export const BIF_CONFIDENCE_SCORING_VERSION = '1.0.0';

/**
 * Base trust per `FieldConfidence`, in 0–1.
 *
 * `EVIDENCE_VERIFIED` is the only level that reflects an independent check.
 * `USER_CONFIRMED` is valid intake and earns real but distinctly lower credit —
 * a client stating something is not the same as it being evidenced.
 * `AI_INFERRED` earns least: it is a guess, however plausible.
 */
const CONFIDENCE_TRUST: Readonly<Record<FieldConfidence, number>> = {
  [FieldConfidence.EVIDENCE_VERIFIED]: 1,
  [FieldConfidence.USER_CONFIRMED]: 0.5,
  [FieldConfidence.AI_INFERRED]: 0.2,
};

/**
 * Multiplier per `FieldSource`, in 0–1. Independent sources (documents, the
 * website, analytics, ad platforms, CRM, research) attest to a value without the
 * business asserting it, and keep full credit. `USER` is discounted because a
 * self-reported value is weaker corroboration even when a citation exists.
 * `DERIVED` inherits from inputs rather than being observed. `AI_INFERRED` as a
 * *source* is discounted hardest.
 */
const SOURCE_MULTIPLIER: Readonly<Record<FieldSource, number>> = {
  [FieldSource.DOCUMENT]: 1,
  [FieldSource.WEBSITE]: 1,
  [FieldSource.RESEARCH]: 1,
  [FieldSource.GA4]: 1,
  [FieldSource.GSC]: 1,
  [FieldSource.GOOGLE_ADS]: 1,
  [FieldSource.META_ADS]: 1,
  [FieldSource.LINKEDIN]: 1,
  [FieldSource.CRM]: 1,
  [FieldSource.USER]: 0.8,
  [FieldSource.DERIVED]: 0.7,
  [FieldSource.AI_INFERRED]: 0.5,
};

/** Sources that attest independently of the business's own statement. */
const INDEPENDENT_SOURCES: ReadonlySet<FieldSource> = new Set([
  FieldSource.DOCUMENT,
  FieldSource.WEBSITE,
  FieldSource.RESEARCH,
  FieldSource.GA4,
  FieldSource.GSC,
  FieldSource.GOOGLE_ADS,
  FieldSource.META_ADS,
  FieldSource.LINKEDIN,
  FieldSource.CRM,
]);

/**
 * Required fields count double in both trust and coverage: BIF marks a field
 * required because the section is not meaningful without it, so a missing
 * required field must hurt more than a missing optional one.
 */
const REQUIRED_FIELD_WEIGHT = 2;
const OPTIONAL_FIELD_WEIGHT = 1;

/** Field trust at or below this counts as provisional/weak in metadata. */
const WEAK_TRUST_THRESHOLD = 0.4;

/**
 * Ceiling applied to root confidence when **no** populated field anywhere is
 * backed by an independent source. Everything is then self-reported, and
 * however complete it is, nothing has been checked against the world.
 */
const NO_EVIDENCE_ROOT_CAP = 40;

/** Whole-percent conversion, rounded half-up and clamped to 0–100. */
function toScore(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

/** Weight a field (or field definition) carries, by whether BIF requires it. */
function fieldWeight(required: boolean): number {
  return required ? REQUIRED_FIELD_WEIGHT : OPTIONAL_FIELD_WEIGHT;
}

/** Trust of one populated field, in 0–1: confidence level × source strength. */
function fieldTrust(field: BIFField): number {
  const base = CONFIDENCE_TRUST[field.confidence] ?? 0;
  const multiplier = SOURCE_MULTIPLIER[field.source] ?? 0;
  return base * multiplier;
}

/** Per-section score plus the inputs that produced it. */
export interface BifSectionConfidenceScore {
  readonly sectionId: string;
  readonly sectionType: SectionType;
  /** 0–100. `sqrt(trust × coverage)`, whole percent. */
  readonly confidenceScore: number;
  /** 0–100. Weighted provenance strength of the fields that are populated. */
  readonly trustScore: number;
  /** 0–100. Weighted share of BIF-defined fields that are populated. */
  readonly coverageScore: number;
  readonly populatedFieldCount: number;
  readonly definedFieldCount: number;
  readonly populatedRequiredFieldCount: number;
  readonly requiredFieldCount: number;
  readonly evidenceBackedFieldCount: number;
  readonly userConfirmedFieldCount: number;
  readonly aiInferredFieldCount: number;
  readonly reasons: readonly string[];
}

/** Everything needed to explain a root score to a future consumer. */
export interface BifConfidenceScoringMetadata {
  readonly scoringVersion: string;
  readonly bifId: string;
  /** 0–100. Equals the returned `bif.confidenceScore`. */
  readonly rootConfidenceScore: number;
  readonly sectionScores: readonly BifSectionConfidenceScore[];
  readonly populatedSectionCount: number;
  readonly totalSectionCount: number;
  readonly populatedFieldCount: number;
  readonly totalFieldCount: number;
  readonly evidenceBackedFieldCount: number;
  readonly userConfirmedFieldCount: number;
  readonly provisionalOrWeakFieldCount: number;
  readonly omittedSections: readonly SectionType[];
  readonly warnings: readonly string[];
  readonly reasons: readonly string[];
}

export interface BifConfidenceScoringResult {
  /** A new BIF with computed root and section confidence. Input is unmutated. */
  readonly bif: BusinessIntelligenceFramework;
  readonly metadata: BifConfidenceScoringMetadata;
}

/**
 * Caller options. Deliberately tiny: the scoring model must not be tunable into
 * flattering a BIF, and nothing here may supply a discovery score.
 */
export interface BifConfidenceScoringOptions {
  /**
   * Canonical section definitions supplying the coverage denominators. Defaults
   * to `BIF_SECTIONS` — BIF's own numbers, not a local restatement. Overridable
   * only so a caller with a narrower canonical set can score against it.
   */
  readonly sectionDefinitions?: readonly BIFSectionDefinition[];
}

const scoreSchema = z.number().int().min(0).max(100);

export const bifSectionConfidenceScoreSchema = z.object({
  sectionId: z.string(),
  sectionType: z.nativeEnum(SectionType),
  confidenceScore: scoreSchema,
  trustScore: scoreSchema,
  coverageScore: scoreSchema,
  populatedFieldCount: z.number().int().min(0),
  definedFieldCount: z.number().int().min(0),
  populatedRequiredFieldCount: z.number().int().min(0),
  requiredFieldCount: z.number().int().min(0),
  evidenceBackedFieldCount: z.number().int().min(0),
  userConfirmedFieldCount: z.number().int().min(0),
  aiInferredFieldCount: z.number().int().min(0),
  reasons: z.array(z.string()),
});

export const bifConfidenceScoringMetadataSchema = z.object({
  scoringVersion: z.string(),
  bifId: z.string(),
  rootConfidenceScore: scoreSchema,
  sectionScores: z.array(bifSectionConfidenceScoreSchema),
  populatedSectionCount: z.number().int().min(0),
  totalSectionCount: z.number().int().min(0),
  populatedFieldCount: z.number().int().min(0),
  totalFieldCount: z.number().int().min(0),
  evidenceBackedFieldCount: z.number().int().min(0),
  userConfirmedFieldCount: z.number().int().min(0),
  provisionalOrWeakFieldCount: z.number().int().min(0),
  omittedSections: z.array(z.nativeEnum(SectionType)),
  warnings: z.array(z.string()),
  reasons: z.array(z.string()),
});

/** Counting result for one section, before it is turned into scores. */
interface SectionTally {
  readonly trustRatio: number;
  readonly coverageRatio: number;
  readonly evidenceBackedFieldCount: number;
  readonly userConfirmedFieldCount: number;
  readonly aiInferredFieldCount: number;
  readonly weakFieldCount: number;
  readonly populatedRequiredFieldCount: number;
}

function tallySection(
  section: BIFSection,
  definition: BIFSectionDefinition | undefined,
): {
  readonly tally: SectionTally;
  readonly definedFieldCount: number;
  readonly requiredFieldCount: number;
} {
  // Denominators come from BIF's own definition when there is one. A section
  // BIF does not define is scored against its own fields, which measures trust
  // honestly while claiming no coverage knowledge it does not have.
  const definedFields = definition?.fields ?? section.fields;
  const definedFieldCount = definedFields.length;
  const requiredFieldCount = definedFields.filter((field) => field.required).length;

  const definedWeightByKey = new Map<string, number>(
    definedFields.map((field) => [field.key, fieldWeight(field.required)]),
  );
  const totalDefinedWeight = [...definedWeightByKey.values()].reduce((sum, w) => sum + w, 0);

  let populatedWeight = 0;
  let trustWeightedSum = 0;
  let evidenceBackedFieldCount = 0;
  let userConfirmedFieldCount = 0;
  let aiInferredFieldCount = 0;
  let weakFieldCount = 0;
  let populatedRequiredFieldCount = 0;

  for (const field of section.fields) {
    const weight = definedWeightByKey.get(field.key) ?? fieldWeight(field.required);
    const trust = fieldTrust(field);
    populatedWeight += weight;
    trustWeightedSum += trust * weight;

    if (field.required) {
      populatedRequiredFieldCount += 1;
    }
    if (
      field.confidence === FieldConfidence.EVIDENCE_VERIFIED &&
      INDEPENDENT_SOURCES.has(field.source)
    ) {
      evidenceBackedFieldCount += 1;
    }
    if (field.confidence === FieldConfidence.USER_CONFIRMED) {
      userConfirmedFieldCount += 1;
    }
    if (field.confidence === FieldConfidence.AI_INFERRED) {
      aiInferredFieldCount += 1;
    }
    if (trust <= WEAK_TRUST_THRESHOLD) {
      weakFieldCount += 1;
    }
  }

  return {
    definedFieldCount,
    requiredFieldCount,
    tally: {
      trustRatio: populatedWeight === 0 ? 0 : trustWeightedSum / populatedWeight,
      coverageRatio: totalDefinedWeight === 0 ? 0 : populatedWeight / totalDefinedWeight,
      evidenceBackedFieldCount,
      userConfirmedFieldCount,
      aiInferredFieldCount,
      weakFieldCount,
      populatedRequiredFieldCount,
    },
  };
}

function sectionReasons(score: Omit<BifSectionConfidenceScore, 'reasons'>): readonly string[] {
  const reasons: string[] = [
    `Confidence ${score.confidenceScore} = sqrt(trust ${score.trustScore} x coverage ${score.coverageScore}): populated-field trust and section coverage are combined so neither can mask the other.`,
    `Coverage ${score.coverageScore}: ${score.populatedFieldCount} of ${score.definedFieldCount} defined fields populated (required fields weighted x${REQUIRED_FIELD_WEIGHT}); ${score.populatedRequiredFieldCount} of ${score.requiredFieldCount} required fields populated.`,
    `Trust ${score.trustScore}: ${score.evidenceBackedFieldCount} independently evidenced, ${score.userConfirmedFieldCount} user-confirmed, ${score.aiInferredFieldCount} AI-inferred.`,
  ];
  if (score.evidenceBackedFieldCount === 0 && score.populatedFieldCount > 0) {
    reasons.push(
      'No populated field in this section is backed by an independent source; every value is self-reported, which caps how much trust it can earn.',
    );
  }
  if (
    score.requiredFieldCount > 0 &&
    score.populatedRequiredFieldCount < score.requiredFieldCount
  ) {
    reasons.push(
      `${score.requiredFieldCount - score.populatedRequiredFieldCount} required field(s) are unpopulated, which reduces coverage at double weight.`,
    );
  }
  return reasons;
}

/**
 * scoreBusinessIntelligenceFramework — compute honest BIF confidence.
 *
 * Returns a **new** BIF whose root and section `confidenceScore` are computed
 * from the BIF's own content, plus metadata explaining every number. The input
 * BIF is not mutated; `status`, `completenessScore`, all `Date`s and all field
 * values are passed through unchanged.
 *
 * Root confidence is the weighted mean of section confidence across **all**
 * canonical sections, weighted by how many fields BIF defines for each. Omitted
 * sections therefore contribute a confidence of zero at their full weight — they
 * lower the root score without any placeholder section being created.
 *
 * @throws if the BIF is structurally invalid (missing/!array `sections`, or a
 * section with a missing/!array `fields`) — such input cannot be scored, and
 * returning a number for it would be fabrication.
 */
export function scoreBusinessIntelligenceFramework(
  bif: BusinessIntelligenceFramework,
  options: BifConfidenceScoringOptions = {},
): BifConfidenceScoringResult {
  if (bif === null || typeof bif !== 'object') {
    throw new Error('scoreBusinessIntelligenceFramework requires a BusinessIntelligenceFramework');
  }
  if (!Array.isArray(bif.sections)) {
    throw new Error('scoreBusinessIntelligenceFramework requires bif.sections to be an array');
  }
  for (const section of bif.sections) {
    if (!Array.isArray(section?.fields)) {
      throw new Error(
        `scoreBusinessIntelligenceFramework requires fields[] on every section (section '${String(section?.id)}' has none)`,
      );
    }
  }

  const sectionDefinitions = options.sectionDefinitions ?? BIF_SECTIONS;
  const definitionByType = new Map<SectionType, BIFSectionDefinition>(
    sectionDefinitions.map((definition) => [definition.type, definition]),
  );

  const sectionScores: BifSectionConfidenceScore[] = [];
  const scoredSections: BIFSection[] = [];
  let populatedFieldCount = 0;
  let evidenceBackedFieldCount = 0;
  let userConfirmedFieldCount = 0;
  let provisionalOrWeakFieldCount = 0;

  for (const section of bif.sections) {
    const { tally, definedFieldCount, requiredFieldCount } = tallySection(
      section,
      definitionByType.get(section.type),
    );

    const trustScore = toScore(tally.trustRatio);
    const coverageScore = toScore(tally.coverageRatio);
    const confidenceScore = toScore(Math.sqrt(tally.trustRatio * tally.coverageRatio));

    const withoutReasons: Omit<BifSectionConfidenceScore, 'reasons'> = {
      sectionId: section.id,
      sectionType: section.type,
      confidenceScore,
      trustScore,
      coverageScore,
      populatedFieldCount: section.fields.length,
      definedFieldCount,
      populatedRequiredFieldCount: tally.populatedRequiredFieldCount,
      requiredFieldCount,
      evidenceBackedFieldCount: tally.evidenceBackedFieldCount,
      userConfirmedFieldCount: tally.userConfirmedFieldCount,
      aiInferredFieldCount: tally.aiInferredFieldCount,
    };

    sectionScores.push({ ...withoutReasons, reasons: sectionReasons(withoutReasons) });
    // New section object; the input section is untouched. Only confidenceScore
    // changes — completenessScore, fields and lastVerifiedAt pass through.
    scoredSections.push({ ...section, confidenceScore });

    populatedFieldCount += section.fields.length;
    evidenceBackedFieldCount += tally.evidenceBackedFieldCount;
    userConfirmedFieldCount += tally.userConfirmedFieldCount;
    provisionalOrWeakFieldCount += tally.weakFieldCount;
  }

  // Root weights come from BIF's own definitions, so omitted sections carry
  // their real weight at zero confidence rather than silently disappearing.
  const scoreByType = new Map<SectionType, number>(
    sectionScores.map((score) => [score.sectionType, score.confidenceScore]),
  );
  let weightedScoreSum = 0;
  let totalWeight = 0;
  let totalFieldCount = 0;
  const omittedSections: SectionType[] = [];
  for (const definition of sectionDefinitions) {
    const weight = definition.fields.length;
    totalWeight += weight;
    totalFieldCount += definition.fields.length;
    const score = scoreByType.get(definition.type);
    if (score === undefined) {
      omittedSections.push(definition.type);
      continue;
    }
    weightedScoreSum += score * weight;
  }

  const uncappedRoot = totalWeight === 0 ? 0 : Math.round(weightedScoreSum / totalWeight);
  const evidenceCapApplies = evidenceBackedFieldCount === 0;
  const rootConfidenceScore = Math.min(
    100,
    Math.max(0, evidenceCapApplies ? Math.min(uncappedRoot, NO_EVIDENCE_ROOT_CAP) : uncappedRoot),
  );

  const warnings: string[] = [];
  if (bif.status !== BIFStatus.Draft) {
    warnings.push(
      `This scoring model was designed for ${BIFStatus.Draft} BIFs; the input status is ${bif.status}. Status is passed through unchanged — scoring never promotes a BIF.`,
    );
  }
  if (omittedSections.length > 0) {
    warnings.push(
      `${omittedSections.length} of ${sectionDefinitions.length} canonical sections are absent (${omittedSections.join(', ')}). They count as zero confidence at full weight; no placeholder section is created.`,
    );
  }
  if (evidenceCapApplies && populatedFieldCount > 0) {
    warnings.push(
      `No populated field is backed by an independent source, so root confidence is capped at ${NO_EVIDENCE_ROOT_CAP}.`,
    );
  }
  if (populatedFieldCount === 0) {
    warnings.push(
      'No populated fields: confidence is 0 because nothing has been captured to trust.',
    );
  }
  warnings.push(
    'BIF confidence measures trust in the produced business intelligence. It is NOT discoveryConfidenceScore, which measures discovery input quality and is never an input to this model.',
  );

  const reasons: string[] = [
    `Root confidence ${rootConfidenceScore} is the field-count-weighted mean of section confidence across all ${sectionDefinitions.length} canonical sections (uncapped mean ${uncappedRoot}).`,
    `Coverage of the canonical framework: ${sectionScores.length} of ${sectionDefinitions.length} sections present, ${populatedFieldCount} of ${totalFieldCount} defined fields populated.`,
    `Provenance mix across populated fields: ${evidenceBackedFieldCount} independently evidenced, ${userConfirmedFieldCount} user-confirmed, ${provisionalOrWeakFieldCount} provisional/weak.`,
    'Each section score combines populated-field trust with section coverage via a geometric mean, so a thinly populated section cannot score high on trust alone.',
  ];
  if (evidenceCapApplies && populatedFieldCount > 0) {
    reasons.push(
      `The no-independent-evidence cap of ${NO_EVIDENCE_ROOT_CAP} was applied to the root score.`,
    );
  }

  return {
    bif: {
      ...bif,
      sections: scoredSections,
      confidenceScore: rootConfidenceScore,
    },
    metadata: {
      scoringVersion: BIF_CONFIDENCE_SCORING_VERSION,
      bifId: bif.id,
      rootConfidenceScore,
      sectionScores,
      populatedSectionCount: sectionScores.length,
      totalSectionCount: sectionDefinitions.length,
      populatedFieldCount,
      totalFieldCount,
      evidenceBackedFieldCount,
      userConfirmedFieldCount,
      provisionalOrWeakFieldCount,
      omittedSections,
      warnings,
      reasons,
    },
  };
}
