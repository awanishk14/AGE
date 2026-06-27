import { z } from 'zod';

export const intentClusterSchema = z.object({
  topic: z.string(),
  urgencyScore: z.number().min(0).max(100),
  buyingProbability: z.number().min(0).max(100),
  relatedKeywords: z.array(z.string()),
  evidenceIds: z.array(z.string()),
});
