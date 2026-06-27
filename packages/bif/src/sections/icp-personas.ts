import { FieldType } from '../core/enums';
import type { BIFFieldDefinition, BIFSectionDefinition } from '../core';
import { SectionType } from '../core/section-type';

/** Static field schema for the ICP & Personas section. */
export const ICP_PERSONAS_FIELDS: readonly BIFFieldDefinition[] = [
  { key: 'idealCustomerProfiles', type: FieldType.Array, required: false },
  { key: 'personas', type: FieldType.Array, required: false },
];

/** Static schema for the ICP & Personas section. */
export const ICP_PERSONAS_SECTION: BIFSectionDefinition = {
  type: SectionType.IcpPersonas,
  name: 'ICP & Personas',
  fields: ICP_PERSONAS_FIELDS,
};
