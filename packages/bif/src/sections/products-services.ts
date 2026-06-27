import { FieldType } from '../core/enums';
import type { BIFFieldDefinition, BIFSectionDefinition } from '../core';
import { SectionType } from '../core/section-type';

/** Static field schema for the Products & Services section. */
export const PRODUCTS_SERVICES_FIELDS: readonly BIFFieldDefinition[] = [
  { key: 'products', type: FieldType.Array, required: false },
];

/** Static schema for the Products & Services section. */
export const PRODUCTS_SERVICES_SECTION: BIFSectionDefinition = {
  type: SectionType.ProductsServices,
  name: 'Products & Services',
  fields: PRODUCTS_SERVICES_FIELDS,
};
