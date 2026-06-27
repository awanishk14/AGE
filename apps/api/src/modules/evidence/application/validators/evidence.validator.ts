import { z } from 'zod';

/** Placeholder Zod schema for the evidence domain. Fields added later. */
export const evidenceSchema = z.object({});

export type EvidenceSchema = z.infer<typeof evidenceSchema>;
