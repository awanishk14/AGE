import { z } from 'zod';

/** Placeholder Zod schema for the project domain. Fields added later. */
export const projectSchema = z.object({});

export type ProjectSchema = z.infer<typeof projectSchema>;
