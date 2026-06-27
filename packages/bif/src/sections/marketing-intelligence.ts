import { FieldType } from '../core/enums';
import type { BIFFieldDefinition, BIFSectionDefinition } from '../core';
import { SectionType } from '../core/section-type';

/** Static field schema for the Marketing Intelligence section. */
export const MARKETING_INTELLIGENCE_FIELDS: readonly BIFFieldDefinition[] = [
  { key: 'seoStatus', type: FieldType.String, required: false },
  { key: 'aeoStatus', type: FieldType.String, required: false },
  { key: 'geoStatus', type: FieldType.String, required: false },
  { key: 'contentMaturity', type: FieldType.String, required: false },
  { key: 'paidAdsStatus', type: FieldType.String, required: false },
  { key: 'emailStatus', type: FieldType.String, required: false },
  { key: 'socialPresence', type: FieldType.String, required: false },
  { key: 'analyticsSetup', type: FieldType.String, required: false },
];

/** Static schema for the Marketing Intelligence section. */
export const MARKETING_INTELLIGENCE_SECTION: BIFSectionDefinition = {
  type: SectionType.MarketingIntelligence,
  name: 'Marketing Intelligence',
  fields: MARKETING_INTELLIGENCE_FIELDS,
};
