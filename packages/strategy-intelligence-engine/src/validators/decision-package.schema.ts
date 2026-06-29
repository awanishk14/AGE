import { z } from 'zod';
import { strategyOpportunitySchema } from './strategy-opportunity.schema';
import { recommendationSchema } from './recommendation.schema';
import { roadmapItemSchema } from './roadmap-item.schema';
import { simulationScenarioSchema } from './simulation-scenario.schema';

export const decisionPackageSchema = z.object({
  opportunities: z.array(strategyOpportunitySchema),
  recommendations: z.array(recommendationSchema),
  roadmap: z.array(roadmapItemSchema),
  simulations: z.array(simulationScenarioSchema),
  generatedAt: z.string(),
  confidenceScore: z.number().min(0).max(100),
});
