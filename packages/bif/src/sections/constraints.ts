import { FieldType } from '../core/enums';
import type { BIFFieldDefinition, BIFSectionDefinition } from '../core';
import { SectionType } from '../core/section-type';

/** Static field schema for the Constraints section. */
export const CONSTRAINTS_FIELDS: readonly BIFFieldDefinition[] = [
  { key: 'budget', type: FieldType.String, required: false },
  { key: 'teamCapacity', type: FieldType.String, required: false },
  { key: 'compliance', type: FieldType.Array, required: false },
  { key: 'approvals', type: FieldType.Array, required: false },
  { key: 'legalConstraints', type: FieldType.Array, required: false },
  { key: 'technicalConstraints', type: FieldType.Array, required: false },
];

/** Static schema for the Constraints section. */
export const CONSTRAINTS_SECTION: BIFSectionDefinition = {
  type: SectionType.Constraints,
  name: 'Constraints',
  fields: CONSTRAINTS_FIELDS,
};
