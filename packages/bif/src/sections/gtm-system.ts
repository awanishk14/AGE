import { FieldType } from '../core/enums';
import type { BIFFieldDefinition, BIFSectionDefinition } from '../core';
import { SectionType } from '../core/section-type';

/** Static field schema for the GTM System section. */
export const GTM_SYSTEM_FIELDS: readonly BIFFieldDefinition[] = [
  { key: 'acquisitionChannels', type: FieldType.Array, required: false },
  { key: 'funnelStages', type: FieldType.Array, required: false },
  { key: 'leadQualification', type: FieldType.String, required: false },
  { key: 'salesProcess', type: FieldType.String, required: false },
  { key: 'retentionStrategy', type: FieldType.String, required: false },
  { key: 'referralStrategy', type: FieldType.String, required: false },
  { key: 'customerJourneyMap', type: FieldType.Object, required: false },
];

/** Static schema for the GTM System section. */
export const GTM_SYSTEM_SECTION: BIFSectionDefinition = {
  type: SectionType.GtmSystem,
  name: 'GTM System',
  fields: GTM_SYSTEM_FIELDS,
};
