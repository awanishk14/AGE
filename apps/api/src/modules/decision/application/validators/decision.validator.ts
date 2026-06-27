import { z } from 'zod';

/** Placeholder Zod schema for the decision domain. Fields added later. */
export const decisionSchema = z.object({});

export type DecisionSchema = z.infer<typeof decisionSchema>;
