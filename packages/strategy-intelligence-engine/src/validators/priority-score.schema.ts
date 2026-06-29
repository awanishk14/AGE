import { z } from 'zod';

const score = z.number().min(0).max(100);

export const priorityScoreSchema = z.object({
  businessImpact: score,
  revenueImpact: score,
  marketingImpact: score,
  customerImpact: score,
  technicalImpact: score,
  risk: score,
  urgency: score,
  effort: score,
  overallScore: score,
});
