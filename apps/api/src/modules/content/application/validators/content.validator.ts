import { z } from 'zod';

/** Placeholder Zod schema for the content domain. Fields added later. */
export const contentSchema = z.object({});

export type ContentSchema = z.infer<typeof contentSchema>;
