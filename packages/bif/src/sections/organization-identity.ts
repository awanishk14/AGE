import { FieldType } from '../core/enums';
import type { BIFFieldDefinition, BIFSectionDefinition } from '../core';
import { SectionType } from '../core/section-type';

/** Static field schema for the Organization Identity section. */
export const ORGANIZATION_IDENTITY_FIELDS: readonly BIFFieldDefinition[] = [
  { key: 'legalName', type: FieldType.String, required: true },
  { key: 'brandNames', type: FieldType.Array, required: false },
  { key: 'website', type: FieldType.String, required: false },
  { key: 'industry', type: FieldType.String, required: false },
  { key: 'subIndustry', type: FieldType.String, required: false },
  { key: 'businessModel', type: FieldType.String, required: false },
  { key: 'revenueModel', type: FieldType.String, required: false },
  { key: 'companySize', type: FieldType.String, required: false },
  { key: 'teamSize', type: FieldType.Number, required: false },
  { key: 'foundedYear', type: FieldType.Number, required: false },
  { key: 'headquarters', type: FieldType.String, required: false },
  { key: 'operatingCountries', type: FieldType.Array, required: false },
  { key: 'languages', type: FieldType.Array, required: false },
  { key: 'description', type: FieldType.String, required: false },
];

/** Static schema for the Organization Identity section. */
export const ORGANIZATION_IDENTITY_SECTION: BIFSectionDefinition = {
  type: SectionType.OrganizationIdentity,
  name: 'Organization Identity',
  fields: ORGANIZATION_IDENTITY_FIELDS,
};
