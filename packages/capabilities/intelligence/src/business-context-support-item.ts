import type { CapabilityOutputItem } from '@age/capability-kit';

/**
 * One BIF section that the scored context actually supports well enough for the
 * Intelligence Capability to treat it as usable business context (ADR-0026,
 * Decision 5).
 *
 * An item is emitted ONLY for a section that is present in the projection and
 * meets the capability's stated support thresholds. There is deliberately no
 * item shape for a missing or weak section: absence is reported as a limitation
 * in the summary, never as an item, and never as a conclusion about the business
 * (ADR-0026, Decision 4).
 *
 * The item restates provenance that the projection already carried — it never
 * derives a score, a judgement or a recommendation from it.
 */
export interface BusinessContextSupportItem extends CapabilityOutputItem {
  /** The BIF section type, as carried by the projection. */
  readonly sectionType: string;
  readonly sectionName: string;
  /** 0–100, copied from the projection. Never recomputed here. */
  readonly sectionConfidenceScore: number;
  /** 0–100, copied from the projection. Never recomputed here. */
  readonly sectionCompletenessScore: number;
  /** Provenance of the fields the section carries, restated verbatim. */
  readonly supportedFields: readonly BusinessContextSupportedField[];
}

/** One populated field backing a supported section, with its provenance. */
export interface BusinessContextSupportedField {
  readonly key: string;
  readonly required: boolean;
  /** `FieldSource` value, carried through as a string — no `@age/bif` import. */
  readonly source: string;
  /** `FieldConfidence` value, carried through as a string — no `@age/bif` import. */
  readonly confidence: string;
}
