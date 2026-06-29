import { FieldType } from '../core/enums';
import type { BIFFieldDefinition, BIFSectionDefinition } from '../core';
import { SectionType } from '../core/section-type';

/** Static field schema for the Vision & Strategy section. */
export const VISION_STRATEGY_FIELDS: readonly BIFFieldDefinition[] = [
  { key: 'vision', type: FieldType.String, required: false },
  { key: 'mission', type: FieldType.String, required: false },
  { key: 'values', type: FieldType.Array, required: false },
  { key: 'longTermGoals', type: FieldType.Array, required: false },
  { key: 'annualObjectives', type: FieldType.Array, required: false },
  { key: 'quarterlyObjectives', type: FieldType.Array, required: false },
  { key: 'strategicPriorities', type: FieldType.Array, required: false },
  { key: 'successDefinition', type: FieldType.String, required: false },
];

/** Static schema for the Vision & Strategy section. */
export const VISION_STRATEGY_SECTION: BIFSectionDefinition = {
  type: SectionType.VisionStrategy,
  name: 'Vision & Strategy',
  fields: VISION_STRATEGY_FIELDS,
};
