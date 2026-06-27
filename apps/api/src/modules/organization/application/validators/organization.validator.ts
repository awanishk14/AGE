import { z } from 'zod';

/** Placeholder Zod schema for the organization domain. Fields added later. */
export const organizationSchema = z.object({});

export type OrganizationSchema = z.infer<typeof organizationSchema>;
