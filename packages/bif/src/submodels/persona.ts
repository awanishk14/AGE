import { z } from 'zod';

/** A buyer persona within an ICP. */
export interface Persona {
  readonly role: string;
  readonly responsibilities: readonly string[];
  readonly painPoints: readonly string[];
  readonly goals: readonly string[];
  readonly objections: readonly string[];
  readonly triggers: readonly string[];
  readonly decisionCriteria: readonly string[];
  readonly channels: readonly string[];
  readonly contentPreferences: readonly string[];
}

export const personaSchema = z.object({
  role: z.string(),
  responsibilities: z.array(z.string()),
  painPoints: z.array(z.string()),
  goals: z.array(z.string()),
  objections: z.array(z.string()),
  triggers: z.array(z.string()),
  decisionCriteria: z.array(z.string()),
  channels: z.array(z.string()),
  contentPreferences: z.array(z.string()),
});
