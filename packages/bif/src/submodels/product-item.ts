import { z } from 'zod';

/** A single product or service offered by the organization. */
export interface ProductItem {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly targetICP: string;
  readonly problemsSolved: readonly string[];
  readonly features: readonly string[];
  readonly pricingModel: string;
  readonly usp: string;
  readonly differentiators: readonly string[];
  readonly competitors: readonly string[];
}

export const productItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  targetICP: z.string(),
  problemsSolved: z.array(z.string()),
  features: z.array(z.string()),
  pricingModel: z.string(),
  usp: z.string(),
  differentiators: z.array(z.string()),
  competitors: z.array(z.string()),
});
