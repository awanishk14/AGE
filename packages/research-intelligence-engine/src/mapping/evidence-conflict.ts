import type { ConflictSeverity } from '../types/enums';

/** A detected contradiction between multiple pieces of evidence for one field. */
export interface EvidenceConflict {
  readonly fieldKey: string;
  readonly conflictingEvidenceIds: readonly string[];
  readonly severity: ConflictSeverity;
}
