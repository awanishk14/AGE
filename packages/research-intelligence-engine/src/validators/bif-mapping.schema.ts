import { z } from 'zod';
import { bifFieldRefSchema } from '@age/bif';
import { BIFMappingAction } from '../types/enums';

export const bifMappingSchema = z.object({
  evidenceId: z.string(),
  target: bifFieldRefSchema,
  action: z.nativeEnum(BIFMappingAction),
  impactScore: z.number().min(0).max(100),
});
