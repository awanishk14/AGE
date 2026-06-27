import { FieldType } from '../core/enums';
import type { BIFFieldDefinition, BIFSectionDefinition } from '../core';
import { SectionType } from '../core/section-type';

/** Static field schema for the KPIs section. */
export const KPIS_FIELDS: readonly BIFFieldDefinition[] = [
  { key: 'business', type: FieldType.Object, required: false },
  { key: 'marketing', type: FieldType.Object, required: false },
  { key: 'paid', type: FieldType.Object, required: false },
  { key: 'content', type: FieldType.Object, required: false },
];

/** Static schema for the KPIs section. */
export const KPIS_SECTION: BIFSectionDefinition = {
  type: SectionType.Kpis,
  name: 'KPIs',
  fields: KPIS_FIELDS,
};
