import { z } from 'zod';

/**
 * CompetitorReference — a named or categorical competitor mentioned during
 * discovery. A reference only: no external lookup, enrichment, or verification
 * is implied by this contract.
 */
export interface CompetitorReference {
  readonly id: string;
  readonly name: string;
  readonly note?: string;
}

export const competitorReferenceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  note: z.string().min(1).optional(),
});
