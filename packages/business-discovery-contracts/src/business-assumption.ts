import { z } from 'zod';
import { assumptionConfidenceSchema, type AssumptionConfidence } from './enums';

/**
 * BusinessAssumption — something treated as true during discovery but not yet
 * verified, with a confidence band. Downstream research (RIE, a future slice)
 * may later confirm or refute these; discovery only flags them.
 */
export interface BusinessAssumption {
  readonly id: string;
  readonly statement: string;
  readonly confidence: AssumptionConfidence;
}

export const businessAssumptionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  confidence: assumptionConfidenceSchema,
});
