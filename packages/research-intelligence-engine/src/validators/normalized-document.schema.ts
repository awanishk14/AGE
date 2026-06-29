import { z } from 'zod';
import { EvidenceSource } from '../types/enums';

export const normalizedDocumentSchema = z.object({
  source: z.nativeEnum(EvidenceSource),
  title: z.string(),
  content: z.string(),
  author: z.string().optional(),
  timestamp: z.string(),
  url: z.string(),
  metadata: z.record(z.unknown()),
});
