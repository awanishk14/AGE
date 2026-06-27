import { z } from 'zod';

/** Placeholder Zod schema for the market domain. Fields added later. */
export const marketSchema = z.object({});

export type MarketSchema = z.infer<typeof marketSchema>;
