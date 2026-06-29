import { z } from 'zod';
import { ConflictSeverity } from '../types/enums';

export const evidenceConflictSchema = z.object({
  fieldKey: z.string(),
  conflictingEvidenceIds: z.array(z.string()),
  severity: z.nativeEnum(ConflictSeverity),
});
