import { z } from 'zod';

/** Placeholder Zod schema for the problem domain. Fields added later. */
export const problemSchema = z.object({});

export type ProblemSchema = z.infer<typeof problemSchema>;
