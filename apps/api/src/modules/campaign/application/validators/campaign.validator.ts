import { z } from 'zod';

/** Placeholder Zod schema for the campaign domain. Fields added later. */
export const campaignSchema = z.object({});

export type CampaignSchema = z.infer<typeof campaignSchema>;
