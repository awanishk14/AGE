import { FieldType } from '../core/enums';
import type { BIFFieldDefinition, BIFSectionDefinition } from '../core';
import { SectionType } from '../core/section-type';

/** Static field schema for the Market & Competition section. */
export const MARKET_COMPETITION_FIELDS: readonly BIFFieldDefinition[] = [
  { key: 'primaryMarket', type: FieldType.String, required: false },
  { key: 'secondaryMarkets', type: FieldType.Array, required: false },
  { key: 'competitors', type: FieldType.Array, required: false },
  { key: 'indirectCompetitors', type: FieldType.Array, required: false },
  { key: 'advantages', type: FieldType.Array, required: false },
  { key: 'weaknesses', type: FieldType.Array, required: false },
  { key: 'trends', type: FieldType.Array, required: false },
  { key: 'risks', type: FieldType.Array, required: false },
  { key: 'opportunities', type: FieldType.Array, required: false },
];

/** Static schema for the Market & Competition section. */
export const MARKET_COMPETITION_SECTION: BIFSectionDefinition = {
  type: SectionType.MarketCompetition,
  name: 'Market & Competition',
  fields: MARKET_COMPETITION_FIELDS,
};
