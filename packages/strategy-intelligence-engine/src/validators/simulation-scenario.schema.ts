import { z } from 'zod';

export const simulationScenarioSchema = z.object({
  title: z.string(),
  description: z.string(),
  assumptions: z.array(z.string()),
  affectedKPIs: z.array(z.string()),
  expectedChange: z.string(),
  confidence: z.number().min(0).max(100),
});
