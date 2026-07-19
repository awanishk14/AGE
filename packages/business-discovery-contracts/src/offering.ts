import { z } from 'zod';
import { offeringKindSchema, type OfferingKind } from './enums';

/**
 * Offering — a single product or service the business sells, with an optional
 * value proposition. Intake shape only; maps later to the BIF product-item
 * submodel (not modeled here).
 */
export interface Offering {
  readonly id: string;
  readonly name: string;
  readonly type: OfferingKind;
  readonly description?: string;
  readonly valueProposition?: string;
}

export const offeringSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: offeringKindSchema,
  description: z.string().min(1).optional(),
  valueProposition: z.string().min(1).optional(),
});
