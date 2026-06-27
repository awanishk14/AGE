import { FieldType } from '../core/enums';
import type { BIFFieldDefinition, BIFSectionDefinition } from '../core';
import { SectionType } from '../core/section-type';

/** Static field schema for the Brand System section. */
export const BRAND_SYSTEM_FIELDS: readonly BIFFieldDefinition[] = [
  { key: 'brandPromise', type: FieldType.String, required: false },
  { key: 'personality', type: FieldType.Array, required: false },
  { key: 'toneOfVoice', type: FieldType.String, required: false },
  { key: 'positioningStatement', type: FieldType.String, required: false },
  { key: 'messagingPillars', type: FieldType.Array, required: false },
  { key: 'taglines', type: FieldType.Array, required: false },
  { key: 'doList', type: FieldType.Array, required: false },
  { key: 'dontList', type: FieldType.Array, required: false },
];

/** Static schema for the Brand System section. */
export const BRAND_SYSTEM_SECTION: BIFSectionDefinition = {
  type: SectionType.BrandSystem,
  name: 'Brand System',
  fields: BRAND_SYSTEM_FIELDS,
};
