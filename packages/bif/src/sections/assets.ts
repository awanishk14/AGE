import { FieldType } from '../core/enums';
import type { BIFFieldDefinition, BIFSectionDefinition } from '../core';
import { SectionType } from '../core/section-type';

/** Static field schema for the Assets section. */
export const ASSETS_FIELDS: readonly BIFFieldDefinition[] = [
  { key: 'websites', type: FieldType.Array, required: false },
  { key: 'landingPages', type: FieldType.Array, required: false },
  { key: 'blogs', type: FieldType.Array, required: false },
  { key: 'videos', type: FieldType.Array, required: false },
  { key: 'caseStudies', type: FieldType.Array, required: false },
  { key: 'socialProfiles', type: FieldType.Array, required: false },
  { key: 'adAccounts', type: FieldType.Array, required: false },
  { key: 'documents', type: FieldType.Array, required: false },
];

/** Static schema for the Assets section. */
export const ASSETS_SECTION: BIFSectionDefinition = {
  type: SectionType.Assets,
  name: 'Assets',
  fields: ASSETS_FIELDS,
};
