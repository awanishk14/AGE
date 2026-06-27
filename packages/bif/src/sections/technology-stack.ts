import { FieldType } from '../core/enums';
import type { BIFFieldDefinition, BIFSectionDefinition } from '../core';
import { SectionType } from '../core/section-type';

/** Static field schema for the Technology Stack section. */
export const TECHNOLOGY_STACK_FIELDS: readonly BIFFieldDefinition[] = [
  { key: 'cms', type: FieldType.String, required: false },
  { key: 'hosting', type: FieldType.String, required: false },
  { key: 'crm', type: FieldType.String, required: false },
  { key: 'analytics', type: FieldType.String, required: false },
  { key: 'adsPlatforms', type: FieldType.Array, required: false },
  { key: 'automationTools', type: FieldType.Array, required: false },
  { key: 'emailPlatform', type: FieldType.String, required: false },
  { key: 'paymentGateway', type: FieldType.String, required: false },
  { key: 'integrations', type: FieldType.Array, required: false },
];

/** Static schema for the Technology Stack section. */
export const TECHNOLOGY_STACK_SECTION: BIFSectionDefinition = {
  type: SectionType.TechnologyStack,
  name: 'Technology Stack',
  fields: TECHNOLOGY_STACK_FIELDS,
};
