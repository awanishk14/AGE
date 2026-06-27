import { z } from 'zod';

/** Placeholder Zod schema for the competitor domain. Fields added later. */
export const competitorSchema = z.object({});

export type CompetitorSchema = z.infer<typeof competitorSchema>;
