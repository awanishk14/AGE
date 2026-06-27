import { z } from 'zod';

/** Placeholder Zod schema for the strategy domain. Fields added later. */
export const strategySchema = z.object({});

export type StrategySchema = z.infer<typeof strategySchema>;
