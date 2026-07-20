import {
  BIFStatus,
  FieldConfidence,
  FieldSource,
  FieldType,
  SectionType,
  type BIFField,
  type BIFFieldDefinition,
  type BIFSection,
  type BusinessIntelligenceFramework,
  type FieldVersion,
} from '@age/bif';
import {
  ASSETS_SECTION,
  BRAND_SYSTEM_SECTION,
  CONSTRAINTS_SECTION,
  GTM_SYSTEM_SECTION,
  ICP_PERSONAS_SECTION,
  MARKET_COMPETITION_SECTION,
  ORGANIZATION_IDENTITY_SECTION,
  PRODUCTS_SERVICES_SECTION,
  VISION_STRATEGY_SECTION,
} from '@age/bif';
import type { BusinessDiscoveryProfile } from './business-discovery-profile';
import { businessDiscoveryProfileSchema } from './business-discovery-profile';
import type { BusinessDiscoveryQuestionnaire } from './questionnaire';
import { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from './default-questionnaire';
import { calculateBusinessDiscoveryCompleteness } from './completeness-scoring';
import {
  getEvidencedFieldPaths,
  PROFILE_SIGNAL_TO_FIELD_PATH,
  type EvidenceableFieldPath,
} from './field-provenance';
import type { EvidenceSourceRef } from './evidence-source-ref';
import type { DiscoverySectionId } from './enums';

/**
 * Discovery → BIF draft mapper — ADR-0025 slice 2.
 *
 * Converts a `BusinessDiscoveryProfile` into a real, canonical
 * `BusinessIntelligenceFramework` in `Draft` status. Implements the four
 * ADR-0025 decisions:
 *
 * 1. **Date determinism** — every `Date` comes from `options.constructedAt`.
 *    This module never calls `new Date()`, `Date.now()`, or any clock.
 * 2. **Field-level provenance** — each emitted `BIFField` carries a `source` and
 *    `confidence` derived from real citations: `EVIDENCE_VERIFIED` only where a
 *    resolvable citation exists (field-level per PR #74, or answer-level), and
 *    `USER` / `USER_CONFIRMED` otherwise, which is accurate for client-stated
 *    intake. `AI_INFERRED` is never emitted — discovery performs no inference.
 *    `changedBy` comes from `options.changedBy` and is never invented.
 * 3. **Score mapping** — discovery completeness maps to BIF completeness.
 *    `discoveryConfidenceScore` is **never** written into any BIF confidence
 *    field; it travels in the mapper metadata. BIF confidence stays a
 *    provisional constant pending a dedicated BIF scoring layer.
 * 4. **Partial Draft** — only sections discovery can honestly populate are
 *    emitted. Absent sections are omitted, never placeholder-filled.
 *
 * `@age/bif` is consumed, never modified: no BIF type, schema or enum is changed
 * or extended here.
 *
 * Pure and deterministic: identical inputs and options always produce an
 * identical result. No I/O, no network, no AI/LLM, no randomness, no generated
 * ids beyond values derived from the inputs. Evidence locators are read as
 * strings and never fetched. Inputs are never mutated.
 */

/** Mapping-rule version. Bump when mapping or provenance rules change. */
export const BUSINESS_DISCOVERY_TO_BIF_MAPPING_VERSION = '1.0.0';

/**
 * Provisional BIF confidence, used for the root and every emitted section.
 *
 * BIF confidence means trust in the business *intelligence*. Discovery produces
 * no intelligence, so no honest value exists yet — and `discoveryConfidenceScore`
 * must not be substituted, since it measures how well-sourced the *intake* is
 * (ADR-0025 Decision 3). `0` is the only non-fabricated option: it asserts
 * nothing. It is provisional under `BIFStatus.Draft` and is expected to be
 * replaced by a dedicated BIF scoring layer. The mapper emits a warning whenever
 * it applies, so a consumer cannot mistake it for a computed score.
 */
export const PROVISIONAL_BIF_CONFIDENCE_SCORE = 0;

/** Caller-supplied context. Nothing here may be defaulted or invented. */
export interface BusinessDiscoveryToBifOptions {
  /**
   * The organization this BIF describes. Required: a discovery profile id
   * identifies an intake record, not an organization, and conflating the two
   * would be a fabricated identity.
   */
  readonly organizationId: string;
  /** Every BIF `Date` is set from this. The mapper never reads a clock. */
  readonly constructedAt: Date;
  /** Actor recorded on every `FieldVersion`. Discovery has no actor of its own. */
  readonly changedBy: string;
  /** Defaults to `bif-<profile id>` — derived from input, never random. */
  readonly bifId?: string;
  /** Defaults to 1 (first draft). */
  readonly version?: number;
  /** Defaults to the curated discovery questionnaire. */
  readonly questionnaire?: BusinessDiscoveryQuestionnaire;
}

/** A discovery field that intentionally has no BIF destination. */
export interface UnmappedDiscoveryField {
  readonly field: string;
  readonly reason: string;
}

/** Per-field provenance actually emitted, for auditability. */
export interface ProvenanceSummary {
  readonly evidenceVerifiedFieldCount: number;
  readonly userConfirmedFieldCount: number;
  readonly aiInferredFieldCount: number;
  readonly evidencedDiscoveryFieldPaths: readonly EvidenceableFieldPath[];
}

/** Everything the BIF root cannot itself carry about how it was built. */
export interface BusinessDiscoveryBifMetadata {
  readonly mappingVersion: string;
  readonly sourceProfileId: string;
  readonly discoveryCompletenessScore: number;
  /** Discovery **input** confidence. Never written into BIF confidence fields. */
  readonly discoveryConfidenceScore: number;
  readonly discoveryReadinessBand: string;
  readonly mappedSections: readonly SectionType[];
  readonly omittedSections: readonly SectionType[];
  readonly unmappedDiscoveryFields: readonly UnmappedDiscoveryField[];
  readonly provenanceSummary: ProvenanceSummary;
  readonly warnings: readonly string[];
}

export interface BusinessDiscoveryToBifResult {
  readonly bif: BusinessIntelligenceFramework;
  readonly metadata: BusinessDiscoveryBifMetadata;
}

/**
 * Which BIF section each mapped discovery area lands in, and which discovery
 * section supplies its completeness score.
 *
 * Curated deliberately. Sections whose BIF field keys cannot receive discovery
 * data honestly are absent — see `STRUCTURALLY_UNMAPPABLE` below.
 */
const SECTION_SOURCE: Readonly<Partial<Record<SectionType, DiscoverySectionId>>> = {
  [SectionType.OrganizationIdentity]: 'business-identity',
  [SectionType.VisionStrategy]: 'goals-constraints',
  [SectionType.ProductsServices]: 'offerings',
  [SectionType.IcpPersonas]: 'customers-icp',
  [SectionType.MarketCompetition]: 'market-competition',
  [SectionType.BrandSystem]: 'positioning-brand',
  [SectionType.GtmSystem]: 'channels',
};

/** Static BIF definitions, so emitted fields reuse canonical keys and `required`. */
const SECTION_DEFINITIONS = [
  ORGANIZATION_IDENTITY_SECTION,
  VISION_STRATEGY_SECTION,
  PRODUCTS_SERVICES_SECTION,
  ICP_PERSONAS_SECTION,
  MARKET_COMPETITION_SECTION,
  BRAND_SYSTEM_SECTION,
  GTM_SYSTEM_SECTION,
  ASSETS_SECTION,
  CONSTRAINTS_SECTION,
] as const;

/**
 * Discovery data with no honest BIF destination. Recorded rather than forced:
 * mapping these would require *inferring* which BIF bucket each free-text entry
 * belongs to, and discovery never infers.
 */
const STRUCTURALLY_UNMAPPABLE: readonly UnmappedDiscoveryField[] = [
  {
    field: 'assets',
    reason:
      "BIF's assets section keys are specific channel types (websites, blogs, videos, socialProfiles, adAccounts, documents…); discovery captures unclassified free text, and sorting it into those buckets would require inference.",
  },
  {
    field: 'constraints',
    reason:
      "BIF's constraints section keys are typed (budget, teamCapacity, compliance, legalConstraints, technicalConstraints); discovery captures unclassified free text, and classifying it would require inference.",
  },
  {
    field: 'assumptions',
    reason:
      'Assumptions are explicitly unverified statements. BIF fields require a source and confidence; emitting assumptions as fields would present unverified content as captured intelligence.',
  },
  {
    field: 'gaps',
    reason: 'Gaps record what is absent. BIF represents present values, not recorded absences.',
  },
  {
    field: 'evidenceSources',
    reason:
      'Carried as field provenance (source/confidence per field) rather than as field values.',
  },
  {
    field: 'sections.answers',
    reason:
      'Captured answers back the structured fields that are mapped; they contribute provenance rather than separate BIF values.',
  },
  {
    field: 'capturedAt',
    reason: 'Superseded by the caller-supplied constructedAt on the emitted BIF.',
  },
];

/** One value destined for a BIF field, with the discovery field that produced it. */
interface MappedValue {
  readonly key: string;
  readonly value: unknown;
  /** Discovery field path whose provenance applies, when one does. */
  readonly fieldPath?: EvidenceableFieldPath;
}

/** Non-empty check that treats blank strings and empty arrays as absent. */
function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

/**
 * The candidate values per BIF section, using canonical BIF field keys.
 * Only keys that exist in the BIF section definitions are produced.
 */
function candidateValues(
  sectionType: SectionType,
  profile: BusinessDiscoveryProfile,
): readonly MappedValue[] {
  switch (sectionType) {
    case SectionType.OrganizationIdentity:
      return [
        { key: 'legalName', value: profile.businessName, fieldPath: 'businessName' },
        { key: 'industry', value: profile.industry, fieldPath: 'industry' },
        { key: 'businessModel', value: profile.businessModel, fieldPath: 'businessModel' },
        { key: 'operatingCountries', value: profile.geographies, fieldPath: 'geographies' },
      ];
    case SectionType.VisionStrategy:
      // Only long-horizon goals have an exact BIF key. Short/medium goals are
      // reported as unmapped rather than guessed into annual/quarterly buckets.
      return [
        {
          key: 'longTermGoals',
          value: profile.goals.filter((goal) => goal.horizon === 'long').map((g) => g.statement),
          fieldPath: 'goals',
        },
      ];
    case SectionType.ProductsServices:
      return [{ key: 'products', value: profile.offerings, fieldPath: 'offerings' }];
    case SectionType.IcpPersonas:
      return [{ key: 'idealCustomerProfiles', value: profile.segments, fieldPath: 'segments' }];
    case SectionType.MarketCompetition:
      return [{ key: 'competitors', value: profile.competitors, fieldPath: 'competitors' }];
    case SectionType.BrandSystem:
      return [
        {
          key: 'positioningStatement',
          value: profile.brandPositioning,
          fieldPath: 'brandPositioning',
        },
      ];
    case SectionType.GtmSystem:
      return [
        {
          key: 'acquisitionChannels',
          value: profile.marketingChannels,
          fieldPath: 'marketingChannels',
        },
      ];
    default:
      return [];
  }
}

/**
 * Discovery field paths that a captured answer cites evidence for, resolved via
 * the question's `satisfiedBy` signal. Only citations naming a declared evidence
 * source count.
 */
function answerEvidencedFieldPaths(
  profile: BusinessDiscoveryProfile,
  questionnaire: BusinessDiscoveryQuestionnaire,
): ReadonlySet<EvidenceableFieldPath> {
  const declaredIds = new Set(profile.evidenceSources.map((source) => source.id));
  const signalByQuestionId = new Map<string, EvidenceableFieldPath>();
  for (const section of questionnaire.sections) {
    for (const question of section.questions) {
      if (question.satisfiedBy === undefined) {
        continue;
      }
      const fieldPath = PROFILE_SIGNAL_TO_FIELD_PATH[question.satisfiedBy];
      if (fieldPath !== undefined) {
        signalByQuestionId.set(question.id, fieldPath);
      }
    }
  }

  const evidenced = new Set<EvidenceableFieldPath>();
  for (const section of profile.sections) {
    for (const answer of section.answers) {
      const fieldPath = signalByQuestionId.get(answer.questionId);
      if (fieldPath === undefined) {
        continue;
      }
      const cited = (answer.evidenceSourceIds ?? []).filter((id) => declaredIds.has(id));
      if (cited.length > 0) {
        evidenced.add(fieldPath);
      }
    }
  }
  return evidenced;
}

/** Evidence-source kind → BIF `FieldSource`. A fixed, curated mapping. */
function sourceFromEvidenceKind(kind: EvidenceSourceRef['kind']): FieldSource {
  switch (kind) {
    case 'document':
      return FieldSource.DOCUMENT;
    case 'url':
      return FieldSource.WEBSITE;
    case 'client-statement':
      return FieldSource.USER;
  }
}

/**
 * The `FieldSource` for an evidenced field: taken from the first cited source in
 * `profile.evidenceSources` declaration order, so the choice is deterministic
 * when several sources of different kinds are cited.
 */
function evidencedFieldSource(
  profile: BusinessDiscoveryProfile,
  fieldPath: EvidenceableFieldPath,
): FieldSource {
  const citedIds = new Set(profile.fieldEvidence?.[fieldPath] ?? []);
  const firstCited = profile.evidenceSources.find((source) => citedIds.has(source.id));
  return firstCited === undefined ? FieldSource.USER : sourceFromEvidenceKind(firstCited.kind);
}

/**
 * mapBusinessDiscoveryToBifDraft — build a `Draft` BIF from a discovery profile.
 *
 * @throws if the profile fails `businessDiscoveryProfileSchema`, or if required
 * caller context (`organizationId`, `constructedAt`, `changedBy`) is missing —
 * none of it may be defaulted.
 */
export function mapBusinessDiscoveryToBifDraft(
  profile: BusinessDiscoveryProfile,
  options: BusinessDiscoveryToBifOptions,
): BusinessDiscoveryToBifResult {
  const parsed = businessDiscoveryProfileSchema.safeParse(profile);
  if (!parsed.success) {
    throw new Error(`Cannot map an invalid business discovery profile: ${parsed.error.message}`);
  }
  if (options.organizationId.trim().length === 0) {
    throw new Error('mapBusinessDiscoveryToBifDraft requires a non-empty organizationId');
  }
  if (options.changedBy.trim().length === 0) {
    throw new Error('mapBusinessDiscoveryToBifDraft requires a non-empty changedBy');
  }
  if (Number.isNaN(options.constructedAt.getTime())) {
    throw new Error('mapBusinessDiscoveryToBifDraft requires a valid constructedAt Date');
  }

  const questionnaire = options.questionnaire ?? DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE;
  const scoring = calculateBusinessDiscoveryCompleteness(profile, questionnaire);

  const evidencedByField = new Set(getEvidencedFieldPaths(profile));
  const evidencedByAnswer = answerEvidencedFieldPaths(profile, questionnaire);

  // Every Date below is this value. The mapper never reads a clock.
  const timestamp = options.constructedAt;
  const bifId = options.bifId ?? `bif-${profile.id}`;

  const sectionCompletenessById = new Map(
    scoring.breakdown.sections.map((section) => [section.sectionId, section.score]),
  );

  const sections: BIFSection[] = [];
  const mappedSections: SectionType[] = [];
  const omittedSections: SectionType[] = [];
  let evidenceVerifiedFieldCount = 0;
  let userConfirmedFieldCount = 0;
  const evidencedDiscoveryFieldPaths = new Set<EvidenceableFieldPath>();

  for (const definition of SECTION_DEFINITIONS) {
    const definedFields = new Map<string, BIFFieldDefinition>(
      definition.fields.map((field) => [field.key, field]),
    );

    const fields: BIFField[] = [];
    for (const candidate of candidateValues(definition.type, profile)) {
      const fieldDefinition = definedFields.get(candidate.key);
      // Only canonical BIF keys are emitted; nothing invents a field.
      if (fieldDefinition === undefined || !hasValue(candidate.value)) {
        continue;
      }

      const isEvidenced =
        candidate.fieldPath !== undefined &&
        (evidencedByField.has(candidate.fieldPath) || evidencedByAnswer.has(candidate.fieldPath));

      const source =
        isEvidenced && candidate.fieldPath !== undefined
          ? evidencedFieldSource(profile, candidate.fieldPath)
          : FieldSource.USER;
      const confidence = isEvidenced
        ? FieldConfidence.EVIDENCE_VERIFIED
        : FieldConfidence.USER_CONFIRMED;

      if (isEvidenced) {
        evidenceVerifiedFieldCount += 1;
        if (candidate.fieldPath !== undefined) {
          evidencedDiscoveryFieldPaths.add(candidate.fieldPath);
        }
      } else {
        userConfirmedFieldCount += 1;
      }

      const initialVersion: FieldVersion = {
        value: candidate.value,
        timestamp,
        source,
        confidence,
        changedBy: options.changedBy,
        reason: 'Initial capture from Business Discovery intake',
      };

      fields.push({
        key: fieldDefinition.key,
        value: candidate.value,
        type: fieldDefinition.type as FieldType,
        required: fieldDefinition.required,
        source,
        confidence,
        lastVerifiedAt: timestamp,
        history: [initialVersion],
      });
    }

    if (fields.length === 0) {
      // Omitted, never placeholder-filled.
      omittedSections.push(definition.type);
      continue;
    }

    const discoverySectionId = SECTION_SOURCE[definition.type];
    const completenessScore =
      discoverySectionId === undefined ? 0 : (sectionCompletenessById.get(discoverySectionId) ?? 0);

    sections.push({
      id: `${bifId}-${definition.type}`,
      type: definition.type,
      name: definition.name,
      fields,
      confidenceScore: PROVISIONAL_BIF_CONFIDENCE_SCORE,
      completenessScore,
      lastVerifiedAt: timestamp,
    });
    mappedSections.push(definition.type);
  }

  // Canonical sections with no discovery source at all.
  for (const sectionType of Object.values(SectionType)) {
    if (!mappedSections.includes(sectionType) && !omittedSections.includes(sectionType)) {
      omittedSections.push(sectionType);
    }
  }

  const unmappedDiscoveryFields: UnmappedDiscoveryField[] = [...STRUCTURALLY_UNMAPPABLE];
  const nonLongGoals = profile.goals.filter((goal) => goal.horizon !== 'long');
  if (nonLongGoals.length > 0) {
    unmappedDiscoveryFields.push({
      field: 'goals[horizon=short|medium]',
      reason:
        "BIF's vision_strategy exposes longTermGoals, annualObjectives and quarterlyObjectives; discovery's short/medium horizons do not correspond to those time boxes, so only long-horizon goals are mapped.",
    });
  }

  const warnings: string[] = [
    `BIF confidence (root and sections) is the provisional constant ${PROVISIONAL_BIF_CONFIDENCE_SCORE}; it is NOT a computed score and NOT discoveryConfidenceScore. A BIF scoring layer must replace it (ADR-0025 Decision 3).`,
    'Status is Draft: only sections discovery can populate are present, and populated sections carry a small subset of their defined BIF fields.',
    'completenessScore reflects discovery capture completeness against the questionnaire, not the proportion of BIF fields populated.',
  ];
  if (
    mappedSections.includes(SectionType.IcpPersonas) ||
    mappedSections.includes(SectionType.ProductsServices)
  ) {
    warnings.push(
      'idealCustomerProfiles / products carry discovery-shaped values; they are not yet conformed to the BIF ICP and ProductItem submodels, which require fields discovery does not capture.',
    );
  }

  const bif: BusinessIntelligenceFramework = {
    id: bifId,
    organizationId: options.organizationId,
    version: options.version ?? 1,
    status: BIFStatus.Draft,
    sections,
    confidenceScore: PROVISIONAL_BIF_CONFIDENCE_SCORE,
    completenessScore: scoring.completenessScore,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastSyncedAt: timestamp,
  };

  return {
    bif,
    metadata: {
      mappingVersion: BUSINESS_DISCOVERY_TO_BIF_MAPPING_VERSION,
      sourceProfileId: profile.id,
      discoveryCompletenessScore: scoring.completenessScore,
      discoveryConfidenceScore: scoring.discoveryConfidenceScore,
      discoveryReadinessBand: scoring.readinessBand,
      mappedSections,
      omittedSections,
      unmappedDiscoveryFields,
      provenanceSummary: {
        evidenceVerifiedFieldCount,
        userConfirmedFieldCount,
        // Discovery never infers; this is asserted, and tested, to stay zero.
        aiInferredFieldCount: 0,
        evidencedDiscoveryFieldPaths: [...evidencedDiscoveryFieldPaths],
      },
      warnings,
    },
  };
}
