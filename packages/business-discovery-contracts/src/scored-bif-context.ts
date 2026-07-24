import { z } from 'zod';
import {
  BIF_SECTIONS,
  BIFStatus,
  FieldConfidence,
  FieldSource,
  FieldType,
  SectionType,
  type BIFField,
  type BIFSection,
  type BIFSectionDefinition,
  type BusinessIntelligenceFramework,
} from '@age/bif';
import type { BifConfidenceScoringMetadata } from './bif-confidence-scoring';

/**
 * ScoredBifContext — the sanctioned, neutral, read-only projection of a scored
 * `Draft` BIF for capability consumption (ADR-0026, Accepted).
 *
 * ADR-0026 Decision 1 forbids a capability package from importing `@age/bif` or
 * consuming the live `BusinessIntelligenceFramework` type. Instead a caller or
 * adapter — this module — projects the scored BIF into a neutral contract and
 * passes it in, exactly as `EvidencePackage` and `MarketDiscoveryInput` are
 * assembled and handed to their capabilities today.
 *
 * This module is that adapter. It legitimately imports `@age/bif` because
 * `@age/business-discovery-contracts` is the sanctioned boundary package that
 * already depends on `@age/bif` and hosts the scoring layer. A capability
 * package must never depend on `@age/bif`; it depends on this projection only.
 *
 * WHAT THE PROJECTION IS — AND IS NOT.
 * - It carries only read-only references and scores a capability needs to reason
 *   about what is supported and where the limits are.
 * - It exposes **no** mutation API: a capability cannot write back through it.
 * - It is **not** a parallel copy of the BIF domain model — no `history`, no
 *   `FieldVersion`, no `Date`, no dependencies/conflicts, no field-definition
 *   schema. Reference and score shapes only, per ADR-0012's warning that a
 *   contracts package "must not grow into a parallel re-implementation of those
 *   engines' domain types."
 * - It **never** creates placeholder sections and **never** infers missing data.
 *   Absent sections are reported as `omittedSections`; there is no writable slot
 *   a capability could fill. Absence is a limitation, never negative evidence.
 *
 * DETERMINISM. `projectScoredBifContext` is pure arithmetic and structural copy
 * over its inputs. No wall-clock (`Date.now`, `new Date`, `performance.now`), no
 * randomness, no I/O, no network, no AI/LLM, no environment reads. Identical
 * input always yields an identical projection. The input BIF is never mutated,
 * `status` is passed through unchanged (this module never promotes a BIF), and
 * scores are copied verbatim — the projection reads numbers, it never computes
 * or edits them.
 *
 * NOT DISCOVERY SCORES. The projection is derived solely from a
 * `BusinessIntelligenceFramework`. `discoveryConfidenceScore` and
 * `discoveryCompletenessScore` are discovery-intake metrics that live on the
 * discovery profile, not on the BIF, so they are structurally out of scope here
 * and cannot leak into capability-facing context.
 */

/** Semver of the projection shape. Bump when the contract shape changes. */
export const SCORED_BIF_CONTEXT_VERSION = '1.0.0';

/**
 * One populated field, projected read-only. Carries provenance
 * (`source`/`confidence`) so a capability can judge whether an individual value
 * can support an insight — but not the field's version `history` or timestamps.
 */
export interface ScoredBifContextField {
  readonly key: string;
  /** The field value, copied by reference. Read-only to the consumer. */
  readonly value: unknown;
  readonly type: FieldType;
  readonly required: boolean;
  readonly source: FieldSource;
  readonly confidence: FieldConfidence;
}

/**
 * One present section, projected read-only. Only emitted sections appear here;
 * absent sections are reported via `ScoredBifContext.omittedSections`.
 */
export interface ScoredBifContextSection {
  readonly id: string;
  readonly type: SectionType;
  readonly name: string;
  /** 0–100. Copied from the scored BIF; not recomputed here. */
  readonly confidenceScore: number;
  /** 0–100. Copied from the scored BIF; not recomputed here. */
  readonly completenessScore: number;
  readonly fields: readonly ScoredBifContextField[];
}

/**
 * A canonical section that is absent from the BIF. Its absence is a limitation
 * to be stated as such — never a conclusion, and never negative evidence.
 */
export interface ScoredBifContextOmittedSection {
  readonly type: SectionType;
  readonly name: string;
}

/**
 * ScoredBifContext — the neutral read-only projection handed to a capability.
 *
 * A capability reasons about `sections` (what is supported), `omittedSections`
 * (the limits, stated as limits), field-level `source`/`confidence` (whether a
 * value can back an insight), and the root/section scores plus `warnings` /
 * `reasons` (so it can explain its own confidence). It can write nothing back.
 */
export interface ScoredBifContext {
  readonly contextVersion: string;
  readonly bifId: string;
  readonly bifStatus: BIFStatus;
  /** 0–100. Root confidence, copied from the scored BIF. */
  readonly bifConfidenceScore: number;
  /** 0–100. Root completeness, copied from the scored BIF. */
  readonly bifCompletenessScore: number;
  /** Present sections only, in BIF order. */
  readonly sections: readonly ScoredBifContextSection[];
  /** Canonical sections absent from the BIF. The limits, stated as limits. */
  readonly omittedSections: readonly ScoredBifContextOmittedSection[];
  /**
   * Explanations of context quality carried through from the scoring layer (when
   * scoring metadata is supplied) plus any projection-level notes (e.g. a
   * non-`Draft` status). Empty when nothing needs saying.
   */
  readonly warnings: readonly string[];
  /** Scoring reasons carried through, when scoring metadata is supplied. */
  readonly reasons: readonly string[];
  /** Counts describing coverage of the canonical framework. */
  readonly metadata: ScoredBifContextMetadata;
}

/** Coverage counts, so a capability can gauge context quality at a glance. */
export interface ScoredBifContextMetadata {
  readonly presentSectionCount: number;
  readonly omittedSectionCount: number;
  readonly canonicalSectionCount: number;
  readonly populatedFieldCount: number;
  /** Present when scoring metadata supplied it; the projection never computes it. */
  readonly scoringVersion?: string;
}

/**
 * Options for {@link projectScoredBifContext}. Deliberately tiny — the
 * projection must not be tunable into flattering a BIF.
 */
export interface ScoredBifContextProjectionOptions {
  /**
   * Scoring metadata from `scoreBusinessIntelligenceFramework`. When supplied,
   * its `omittedSections`, `warnings`, `reasons` and `scoringVersion` are carried
   * through verbatim. When omitted, `omittedSections` are computed structurally
   * from the canonical definitions and `warnings`/`reasons` stay empty (aside
   * from a projection-level non-`Draft` note).
   */
  readonly scoringMetadata?: BifConfidenceScoringMetadata;
  /**
   * Canonical section definitions naming the full framework, used to report
   * omitted sections when no scoring metadata is supplied. Defaults to
   * `BIF_SECTIONS` — BIF's own set, not a local restatement.
   */
  readonly sectionDefinitions?: readonly BIFSectionDefinition[];
}

const scoreSchema = z.number().min(0).max(100);

export const scoredBifContextFieldSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  type: z.nativeEnum(FieldType),
  required: z.boolean(),
  source: z.nativeEnum(FieldSource),
  confidence: z.nativeEnum(FieldConfidence),
});

export const scoredBifContextSectionSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(SectionType),
  name: z.string(),
  confidenceScore: scoreSchema,
  completenessScore: scoreSchema,
  fields: z.array(scoredBifContextFieldSchema),
});

export const scoredBifContextOmittedSectionSchema = z.object({
  type: z.nativeEnum(SectionType),
  name: z.string(),
});

export const scoredBifContextMetadataSchema = z.object({
  presentSectionCount: z.number().int().min(0),
  omittedSectionCount: z.number().int().min(0),
  canonicalSectionCount: z.number().int().min(0),
  populatedFieldCount: z.number().int().min(0),
  scoringVersion: z.string().optional(),
});

export const scoredBifContextSchema = z.object({
  contextVersion: z.string(),
  bifId: z.string(),
  bifStatus: z.nativeEnum(BIFStatus),
  bifConfidenceScore: scoreSchema,
  bifCompletenessScore: scoreSchema,
  sections: z.array(scoredBifContextSectionSchema),
  omittedSections: z.array(scoredBifContextOmittedSectionSchema),
  warnings: z.array(z.string()),
  reasons: z.array(z.string()),
  metadata: scoredBifContextMetadataSchema,
});

/** Project one populated field, dropping history/timestamps. */
function projectField(field: BIFField): ScoredBifContextField {
  return {
    key: field.key,
    value: field.value,
    type: field.type,
    required: field.required,
    source: field.source,
    confidence: field.confidence,
  };
}

/** Project one present section, dropping `lastVerifiedAt`. */
function projectSection(section: BIFSection): ScoredBifContextSection {
  return {
    id: section.id,
    type: section.type,
    name: section.name,
    confidenceScore: section.confidenceScore,
    completenessScore: section.completenessScore,
    fields: section.fields.map(projectField),
  };
}

/**
 * projectScoredBifContext — project a scored `Draft` BIF into a neutral,
 * read-only {@link ScoredBifContext} for capability consumption.
 *
 * The input BIF is not mutated. `status` is copied through unchanged (the
 * projection never promotes a BIF), scores are copied verbatim (never
 * recomputed), and no timestamp is read or invented. Only present sections are
 * projected; absent canonical sections are reported separately in
 * `omittedSections`. No placeholder section is ever created and no missing value
 * is ever inferred.
 *
 * If the BIF status is not `Draft`, the projection still runs but adds a warning
 * — the accepted contract is `Draft`, and reporting the mismatch is more honest
 * than refusing to project.
 *
 * @throws if the BIF is structurally invalid (missing/!array `sections`, or a
 * section with a missing/!array `fields`) — such input cannot be projected, and
 * fabricating a shape for it would violate the non-fabrication rule.
 */
export function projectScoredBifContext(
  scoredBif: BusinessIntelligenceFramework,
  options: ScoredBifContextProjectionOptions = {},
): ScoredBifContext {
  if (scoredBif === null || typeof scoredBif !== 'object') {
    throw new Error('projectScoredBifContext requires a BusinessIntelligenceFramework');
  }
  if (!Array.isArray(scoredBif.sections)) {
    throw new Error('projectScoredBifContext requires bif.sections to be an array');
  }
  for (const section of scoredBif.sections) {
    if (!Array.isArray(section?.fields)) {
      throw new Error(
        `projectScoredBifContext requires fields[] on every section (section '${String(section?.id)}' has none)`,
      );
    }
  }

  const sectionDefinitions = options.sectionDefinitions ?? BIF_SECTIONS;
  const sections = scoredBif.sections.map(projectSection);
  const populatedFieldCount = sections.reduce((sum, section) => sum + section.fields.length, 0);

  // Omitted sections: prefer the scoring layer's own list (already computed
  // against the canonical set). Otherwise derive structurally from the canonical
  // definitions minus the section types actually present. Either way, absence is
  // reported as absence — no placeholder section is created.
  const nameByType = new Map<SectionType, string>(
    sectionDefinitions.map((definition) => [definition.type, definition.name]),
  );
  const presentTypes = new Set<SectionType>(sections.map((section) => section.type));
  const omittedTypes = options.scoringMetadata?.omittedSections
    ? options.scoringMetadata.omittedSections
    : sectionDefinitions
        .map((definition) => definition.type)
        .filter((type) => !presentTypes.has(type));
  const omittedSections: ScoredBifContextOmittedSection[] = omittedTypes.map((type) => ({
    type,
    name: nameByType.get(type) ?? String(type),
  }));

  const warnings: string[] = [];
  if (scoredBif.status !== BIFStatus.Draft) {
    warnings.push(
      `ScoredBifContext is defined for ${BIFStatus.Draft} BIFs; the input status is ${scoredBif.status}. Status is projected through unchanged — this projection never promotes a BIF.`,
    );
  }
  if (options.scoringMetadata) {
    warnings.push(...options.scoringMetadata.warnings);
  }

  const reasons: string[] = options.scoringMetadata ? [...options.scoringMetadata.reasons] : [];

  return {
    contextVersion: SCORED_BIF_CONTEXT_VERSION,
    bifId: scoredBif.id,
    bifStatus: scoredBif.status,
    bifConfidenceScore: scoredBif.confidenceScore,
    bifCompletenessScore: scoredBif.completenessScore,
    sections,
    omittedSections,
    warnings,
    reasons,
    metadata: {
      presentSectionCount: sections.length,
      omittedSectionCount: omittedSections.length,
      canonicalSectionCount: sectionDefinitions.length,
      populatedFieldCount,
      scoringVersion: options.scoringMetadata?.scoringVersion,
    },
  };
}
