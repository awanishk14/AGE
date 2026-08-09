import { z } from 'zod';
import { answerProvenanceSchema, type AnswerProvenance } from './answer-provenance';

/**
 * DiscoveryAnswer — a captured response to a DiscoveryQuestion. `value` is a
 * string for text/longText/choice questions, or a string array for list
 * questions (shape matches the question's `kind`). `evidenceSourceIds` are plain
 * references into the profile's evidence sources.
 *
 * ⚠️ `provenance` IS REQUIRED AND HAS NO DEFAULT (ADR-0059 D2). It records HOW
 * the answer was obtained, which stopped being a constant the moment assisted
 * intake was authorized. 🚫 Do not make it optional "for compatibility": every
 * existing answer is `stated`, and that is a true statement about them rather
 * than a migration default — so every existing site says so out loud.
 *
 * ⚠️ `provenance` is NOT `evidenceSourceIds`. Evidence is what the answer cites;
 * provenance is who produced the answer. An answer can have both, either or
 * neither of those relationships, and collapsing them would let a citation stand
 * in for a human's acceptance.
 */
export interface DiscoveryAnswer {
  readonly questionId: string;
  readonly value: string | readonly string[];
  readonly provenance: AnswerProvenance;
  readonly evidenceSourceIds?: readonly string[];
}

export const discoveryAnswerSchema = z.object({
  questionId: z.string().min(1),
  value: z.union([z.string(), z.array(z.string())]),
  provenance: answerProvenanceSchema,
  evidenceSourceIds: z.array(z.string().min(1)).optional(),
});
