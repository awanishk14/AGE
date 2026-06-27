import { z } from 'zod';
import { FieldSource } from './enums';

/** Resolution state of a tracked field conflict. */
export type FieldConflictResolutionStatus = 'UNRESOLVED' | 'RESOLVED' | 'IGNORED';

/**
 * FieldConflict — tracks contradictory values reported for the same field by
 * different sources (e.g. website says $10M, LinkedIn says $5M, founder says ~$7M).
 *
 * Tracking layer only. This package performs NO conflict resolution — AGE must
 * never overwrite reality blindly. It records the disagreement so an intelligence
 * layer can resolve it later, with provenance intact.
 */
export interface FieldConflict {
  readonly fieldKey: string;
  readonly values: readonly unknown[];
  readonly sources: readonly FieldSource[];
  readonly resolutionStatus: FieldConflictResolutionStatus;
  readonly resolvedValue?: unknown;
}

export const fieldConflictSchema = z.object({
  fieldKey: z.string(),
  values: z.array(z.unknown()),
  sources: z.array(z.nativeEnum(FieldSource)),
  resolutionStatus: z.enum(['UNRESOLVED', 'RESOLVED', 'IGNORED']),
  resolvedValue: z.unknown().optional(),
});
