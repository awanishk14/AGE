import { SectionType } from '@age/bif';

import type { EvidenceableFieldPath } from './field-provenance';

/**
 * Which discovery field produced which BIF field (ADR-0066 D6, slice 5).
 *
 * ⚠️ **THE SINGLE SOURCE OF THAT LINK.** `candidateValues` in
 * `business-discovery-to-bif.ts` reads its `fieldPath` from this table rather
 * than repeating it, so a surface asking "where did this BIF field come from?"
 * and the mapper deciding "which field's evidence applies here?" can never give
 * two different answers. 🚫 Do not inline a field path back into the mapper: the
 * copy that drifts is always the one nobody runs the demo against.
 *
 * 🚫 **IT CARRIES NO VALUE, NO SCORE AND NO PROVENANCE.** It is a static map of
 * key → field path and nothing more. AGE-INV-PROV-1 holds by shape here too:
 * this table is identical whatever any answer's provenance was, so joining a
 * provenance channel through it cannot move a number.
 *
 * ⚠️ A BIF field with **no** row is not an error — `SectionType`s that discovery
 * does not feed have none, and 🚫 an absent row must never be defaulted to a
 * plausible-looking field path.
 */
export interface BifFieldOrigin {
  readonly sectionType: SectionType;
  /** The canonical BIF field key, exactly as the BIF section defines it. */
  readonly key: string;
  /** The discovery profile field whose value was transcribed into it. */
  readonly fieldPath: EvidenceableFieldPath;
}

export const BIF_FIELD_ORIGINS: readonly BifFieldOrigin[] = Object.freeze([
  Object.freeze({
    sectionType: SectionType.OrganizationIdentity,
    key: 'legalName',
    fieldPath: 'businessName' as const,
  }),
  Object.freeze({
    sectionType: SectionType.OrganizationIdentity,
    key: 'industry',
    fieldPath: 'industry' as const,
  }),
  Object.freeze({
    sectionType: SectionType.OrganizationIdentity,
    key: 'businessModel',
    fieldPath: 'businessModel' as const,
  }),
  Object.freeze({
    sectionType: SectionType.OrganizationIdentity,
    key: 'operatingCountries',
    fieldPath: 'geographies' as const,
  }),
  Object.freeze({
    sectionType: SectionType.VisionStrategy,
    key: 'longTermGoals',
    fieldPath: 'goals' as const,
  }),
  Object.freeze({
    sectionType: SectionType.ProductsServices,
    key: 'products',
    fieldPath: 'offerings' as const,
  }),
  Object.freeze({
    sectionType: SectionType.IcpPersonas,
    key: 'idealCustomerProfiles',
    fieldPath: 'segments' as const,
  }),
  Object.freeze({
    sectionType: SectionType.MarketCompetition,
    key: 'competitors',
    fieldPath: 'competitors' as const,
  }),
  Object.freeze({
    sectionType: SectionType.BrandSystem,
    key: 'positioningStatement',
    fieldPath: 'brandPositioning' as const,
  }),
  Object.freeze({
    sectionType: SectionType.GtmSystem,
    key: 'acquisitionChannels',
    fieldPath: 'marketingChannels' as const,
  }),
]);

/**
 * The discovery field behind one BIF field, or `undefined` when discovery does
 * not feed it.
 *
 * 🚫 `undefined` is a real answer and must be shown as one — "AGE has no record
 * of where this came from" — 🚫 never smoothed into the nearest field path and
 * 🚫 never into a default provenance (ADR-0066 §0.4c).
 */
export function discoveryFieldPathForBifField(
  sectionType: SectionType,
  key: string,
): EvidenceableFieldPath | undefined {
  return BIF_FIELD_ORIGINS.find(
    (origin) => origin.sectionType === sectionType && origin.key === key,
  )?.fieldPath;
}
