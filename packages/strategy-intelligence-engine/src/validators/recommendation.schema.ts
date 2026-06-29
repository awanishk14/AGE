import { z } from 'zod';

export const recommendationSchema = z.object({
  id: z.string(),
  opportunityId: z.string(),
  recommendation: z.string(),
  rationale: z.string(),
  expectedOutcome: z.string(),
  dependencies: z.array(z.string()),
  confidence: z.number().min(0).max(100),
});
