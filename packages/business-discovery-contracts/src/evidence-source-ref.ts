import { z } from 'zod';
import { evidenceSourceKindSchema, type EvidenceSourceKind } from './enums';

/**
 * EvidenceSourceRef — where a captured fact comes from. A plain reference only:
 * a `url` locator is a string, never fetched; no scraping or network access is
 * implied or performed by this contract.
 */
export interface EvidenceSourceRef {
  readonly id: string;
  readonly label: string;
  readonly kind: EvidenceSourceKind;
  readonly locator?: string;
}

export const evidenceSourceRefSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: evidenceSourceKindSchema,
  locator: z.string().min(1).optional(),
});
