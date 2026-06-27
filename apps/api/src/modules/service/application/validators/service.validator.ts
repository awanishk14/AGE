import { z } from 'zod';

/** Placeholder Zod schema for the service domain. Fields added later. */
export const serviceSchema = z.object({});

export type ServiceSchema = z.infer<typeof serviceSchema>;
