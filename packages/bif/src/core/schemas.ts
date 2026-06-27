import { z } from 'zod';
import { BIFStatus, FieldConfidence, FieldSource, FieldType } from './enums';
import { SectionType } from './section-type';

/** Zod schemas mirroring the BIF core interfaces. Validation only; no logic. */
export const score = z.number().min(0).max(100);

export const fieldVersionSchema = z.object({
  value: z.unknown(),
  timestamp: z.date(),
  source: z.nativeEnum(FieldSource),
  confidence: z.nativeEnum(FieldConfidence),
  changedBy: z.string(),
  reason: z.string().optional(),
});

export const bifFieldSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  type: z.nativeEnum(FieldType),
  required: z.boolean(),
  source: z.nativeEnum(FieldSource),
  confidence: z.nativeEnum(FieldConfidence),
  lastVerifiedAt: z.date(),
  history: z.array(fieldVersionSchema),
});

export const bifSectionSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(SectionType),
  name: z.string(),
  fields: z.array(bifFieldSchema),
  confidenceScore: score,
  completenessScore: score,
  lastVerifiedAt: z.date(),
});

export const businessIntelligenceFrameworkSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  version: z.number().int().nonnegative(),
  status: z.nativeEnum(BIFStatus),
  sections: z.array(bifSectionSchema),
  confidenceScore: score,
  completenessScore: score,
  createdAt: z.date(),
  updatedAt: z.date(),
  lastSyncedAt: z.date(),
});
