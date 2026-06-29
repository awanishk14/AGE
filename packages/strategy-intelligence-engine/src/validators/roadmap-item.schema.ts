import { z } from 'zod';
import { RoadmapPhase } from '../types/enums';

export const roadmapItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  phase: z.nativeEnum(RoadmapPhase),
  owner: z.string(),
  estimatedDuration: z.string(),
  dependencies: z.array(z.string()),
  successMetrics: z.array(z.string()),
});
