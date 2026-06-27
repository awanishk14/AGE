import { z } from 'zod';

/** An Ideal Customer Profile. */
export interface ICP {
  readonly industry: string;
  readonly companySize: string;
  readonly geography: string;
  readonly revenueRange: string;
  readonly techStack: readonly string[];
  readonly buyingMaturity: string;
  readonly budgetRange: string;
}

export const icpSchema = z.object({
  industry: z.string(),
  companySize: z.string(),
  geography: z.string(),
  revenueRange: z.string(),
  techStack: z.array(z.string()),
  buyingMaturity: z.string(),
  budgetRange: z.string(),
});
