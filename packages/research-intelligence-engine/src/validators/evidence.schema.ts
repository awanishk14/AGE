import { z } from 'zod';
import { EvidenceSource, SignalType } from '../types/enums';
import { extractedSignalSchema } from './extracted-signal.schema';

export const evidenceEntityLinkSchema = z.object({
  organizationId: z.string().optional(),
  productId: z.string().optional(),
  competitorId: z.string().optional(),
  marketId: z.string().optional(),
});

export const evidenceSchema = z.object({
  id: z.string(),
  source: z.nativeEnum(EvidenceSource),
  sourceUrl: z.string(),
  timestamp: z.string(),
  entityLinked: evidenceEntityLinkSchema,
  signalType: z.nativeEnum(SignalType),
  rawContent: z.string(),
  extractedSignals: z.array(extractedSignalSchema),
  confidence: z.number().min(0).max(100),
  metadata: z.record(z.unknown()),
});
