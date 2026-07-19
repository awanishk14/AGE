import { z } from 'zod';

/**
 * CustomerSegment — an ICP / target segment captured during discovery. Aligns
 * conceptually with the BIF ICP submodel, but is intentionally lighter: it is
 * intake data, not the canonical BIF model. Only `id` and `name` are required.
 */
export interface CustomerSegment {
  readonly id: string;
  readonly name: string;
  readonly industry?: string;
  readonly companySize?: string;
  readonly geography?: string;
  readonly description?: string;
}

export const customerSegmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  industry: z.string().min(1).optional(),
  companySize: z.string().min(1).optional(),
  geography: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
});
