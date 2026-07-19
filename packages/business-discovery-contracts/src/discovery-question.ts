import { z } from 'zod';
import {
  discoveryQuestionKindSchema,
  discoverySectionIdSchema,
  type DiscoveryQuestionKind,
  type DiscoverySectionId,
} from './enums';

/**
 * DiscoveryQuestion — one curated prompt within a section. `choices` is only
 * meaningful when `kind === 'choice'`. These are a fixed, curated set anchored to
 * BIF-aligned concepts — NOT a generic runtime form builder.
 */
export interface DiscoveryQuestion {
  readonly id: string;
  readonly sectionId: DiscoverySectionId;
  readonly prompt: string;
  readonly required: boolean;
  readonly kind: DiscoveryQuestionKind;
  readonly choices?: readonly string[];
}

export const discoveryQuestionSchema = z.object({
  id: z.string().min(1),
  sectionId: discoverySectionIdSchema,
  prompt: z.string().min(1),
  required: z.boolean(),
  kind: discoveryQuestionKindSchema,
  choices: z.array(z.string().min(1)).optional(),
});
