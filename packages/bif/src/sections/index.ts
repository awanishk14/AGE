export * from './organization-identity';
export * from './vision-strategy';
export * from './products-services';
export * from './icp-personas';
export * from './market-competition';
export * from './brand-system';
export * from './gtm-system';
export * from './marketing-intelligence';
export * from './technology-stack';
export * from './assets';
export * from './kpis';
export * from './constraints';

import { ORGANIZATION_IDENTITY_SECTION } from './organization-identity';
import { VISION_STRATEGY_SECTION } from './vision-strategy';
import { PRODUCTS_SERVICES_SECTION } from './products-services';
import { ICP_PERSONAS_SECTION } from './icp-personas';
import { MARKET_COMPETITION_SECTION } from './market-competition';
import { BRAND_SYSTEM_SECTION } from './brand-system';
import { GTM_SYSTEM_SECTION } from './gtm-system';
import { MARKETING_INTELLIGENCE_SECTION } from './marketing-intelligence';
import { TECHNOLOGY_STACK_SECTION } from './technology-stack';
import { ASSETS_SECTION } from './assets';
import { KPIS_SECTION } from './kpis';
import { CONSTRAINTS_SECTION } from './constraints';
import type { BIFSectionDefinition } from '../core';

/**
 * BIF_SECTIONS — the canonical, ordered list of section definitions that make up
 * the Business Intelligence Framework. Static schema; no values.
 */
export const BIF_SECTIONS: readonly BIFSectionDefinition[] = [
  ORGANIZATION_IDENTITY_SECTION,
  VISION_STRATEGY_SECTION,
  PRODUCTS_SERVICES_SECTION,
  ICP_PERSONAS_SECTION,
  MARKET_COMPETITION_SECTION,
  BRAND_SYSTEM_SECTION,
  GTM_SYSTEM_SECTION,
  MARKETING_INTELLIGENCE_SECTION,
  TECHNOLOGY_STACK_SECTION,
  ASSETS_SECTION,
  KPIS_SECTION,
  CONSTRAINTS_SECTION,
];
