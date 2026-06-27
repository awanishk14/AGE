import { z } from 'zod';

/** Placeholder Zod schema for the research domain. Fields added later. */
export const researchSchema = z.object({});

export type ResearchSchema = z.infer<typeof researchSchema>;
