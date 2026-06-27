import { z } from 'zod';

/** Placeholder Zod schema for the integration domain. Fields added later. */
export const integrationSchema = z.object({});

export type IntegrationSchema = z.infer<typeof integrationSchema>;
