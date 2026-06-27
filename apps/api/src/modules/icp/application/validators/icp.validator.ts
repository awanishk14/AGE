import { z } from 'zod';

/** Placeholder Zod schema for the icp domain. Fields added later. */
export const icpSchema = z.object({});

export type IcpSchema = z.infer<typeof icpSchema>;
