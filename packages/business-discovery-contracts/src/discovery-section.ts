import { z } from 'zod';
import { discoverySectionIdSchema, type DiscoverySectionId } from './enums';
import { discoveryQuestionSchema, type DiscoveryQuestion } from './discovery-question';
import { discoveryAnswerSchema, type DiscoveryAnswer } from './discovery-answer';

/**
 * DiscoverySection — a BIF-aligned grouping of questions plus the answers
 * captured for them. Sections structure the intake; they hold no behavior.
 */
export interface DiscoverySection {
  readonly id: DiscoverySectionId;
  readonly name: string;
  readonly questions: readonly DiscoveryQuestion[];
  readonly answers: readonly DiscoveryAnswer[];
}

export const discoverySectionSchema = z.object({
  id: discoverySectionIdSchema,
  name: z.string().min(1),
  questions: z.array(discoveryQuestionSchema),
  answers: z.array(discoveryAnswerSchema),
});
