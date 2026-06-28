import { z } from 'zod';
import { SectionType } from '@age/bif';
import { BIFMappingAction } from '../types/enums';

export const bifMappingTargetSchema = z.object({
  section: z.nativeEnum(SectionType),
  fieldKey: z.string(),
});

export const bifMappingSchema = z.object({
  evidenceId: z.string(),
  target: bifMappingTargetSchema,
  action: z.nativeEnum(BIFMappingAction),
  impactScore: z.number().min(0).max(100),
});
