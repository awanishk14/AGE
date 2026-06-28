import { z } from 'zod';
import { bifFieldRefSchema } from '@age/bif';
import { OpportunityCategory, Priority } from '../types/enums';

const score = z.number().min(0).max(100);

export const strategyOpportunitySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.nativeEnum(OpportunityCategory),
  priority: z.nativeEnum(Priority),
  estimatedImpact: score,
  estimatedEffort: score,
  confidence: score,
  supportingEvidenceIds: z.array(z.string()),
  supportingBIFFields: z.array(bifFieldRefSchema),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
});
