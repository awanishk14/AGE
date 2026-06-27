import { z } from 'zod';
import { Polarity } from '../types/enums';

export const extractedSignalSchema = z.object({
  type: z.string(),
  value: z.unknown(),
  targetField: z.string(),
  strength: z.number().min(0).max(100),
  polarity: z.nativeEnum(Polarity),
});
