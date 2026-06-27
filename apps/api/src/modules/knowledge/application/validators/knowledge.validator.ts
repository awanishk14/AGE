import { z } from 'zod';

/** Placeholder Zod schema for the knowledge domain. Fields added later. */
export const knowledgeSchema = z.object({});

export type KnowledgeSchema = z.infer<typeof knowledgeSchema>;
