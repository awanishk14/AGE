import { z } from 'zod';

/** Business KPIs. */
export interface KpiBusiness {
  readonly revenue?: number;
  readonly pipeline?: number;
  readonly cac?: number;
  readonly ltv?: number;
}

/** Marketing KPIs. */
export interface KpiMarketing {
  readonly organicTraffic?: number;
  readonly leads?: number;
  readonly conversions?: number;
  readonly rankings?: number;
  readonly aiVisibility?: number;
}

/** Paid-media KPIs. */
export interface KpiPaid {
  readonly roas?: number;
  readonly cpa?: number;
  readonly cpc?: number;
  readonly ctr?: number;
}

/** Content KPIs. */
export interface KpiContent {
  readonly impressions?: number;
  readonly engagement?: number;
  readonly indexedPages?: number;
  readonly assistedConversions?: number;
}

/** The full KPI block. */
export interface Kpis {
  readonly business: KpiBusiness;
  readonly marketing: KpiMarketing;
  readonly paid: KpiPaid;
  readonly content: KpiContent;
}

export const kpiBusinessSchema = z.object({
  revenue: z.number().optional(),
  pipeline: z.number().optional(),
  cac: z.number().optional(),
  ltv: z.number().optional(),
});
export const kpiMarketingSchema = z.object({
  organicTraffic: z.number().optional(),
  leads: z.number().optional(),
  conversions: z.number().optional(),
  rankings: z.number().optional(),
  aiVisibility: z.number().optional(),
});
export const kpiPaidSchema = z.object({
  roas: z.number().optional(),
  cpa: z.number().optional(),
  cpc: z.number().optional(),
  ctr: z.number().optional(),
});
export const kpiContentSchema = z.object({
  impressions: z.number().optional(),
  engagement: z.number().optional(),
  indexedPages: z.number().optional(),
  assistedConversions: z.number().optional(),
});
export const kpisSchema = z.object({
  business: kpiBusinessSchema,
  marketing: kpiMarketingSchema,
  paid: kpiPaidSchema,
  content: kpiContentSchema,
});
