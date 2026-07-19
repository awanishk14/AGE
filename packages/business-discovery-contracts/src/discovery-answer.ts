import { z } from 'zod';

/**
 * DiscoveryAnswer — a captured response to a DiscoveryQuestion. `value` is a
 * string for text/longText/choice questions, or a string array for list
 * questions (shape matches the question's `kind`). `evidenceSourceIds` are plain
 * references into the profile's evidence sources.
 */
export interface DiscoveryAnswer {
  readonly questionId: string;
  readonly value: string | readonly string[];
  readonly evidenceSourceIds?: readonly string[];
}

export const discoveryAnswerSchema = z.object({
  questionId: z.string().min(1),
  value: z.union([z.string(), z.array(z.string())]),
  evidenceSourceIds: z.array(z.string().min(1)).optional(),
});
