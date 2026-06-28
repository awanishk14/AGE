import type { BIFFieldRef } from '@age/bif';
import type { BIFMappingAction } from '../types/enums';

/**
 * BIFMapping — a PROPOSAL to change BIF based on evidence.
 *
 * RULE: the RIE must NOT modify BIF directly. It only produces mapping
 * proposals; an upstream engine decides whether to apply them.
 *
 * `target` is a canonical `BIFFieldRef` (Gap 1 hardening): every proposal
 * addresses exactly one, unambiguous BIF field.
 */
export interface BIFMapping {
  readonly evidenceId: string;
  readonly target: BIFFieldRef;
  readonly action: BIFMappingAction;
  /** 0–100. */
  readonly impactScore: number;
}
