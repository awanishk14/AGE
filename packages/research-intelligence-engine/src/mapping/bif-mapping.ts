import type { SectionType } from '@age/bif';
import type { BIFMappingAction } from '../types/enums';

/** The BIF location a mapping targets. */
export interface BIFMappingTarget {
  readonly section: SectionType;
  readonly fieldKey: string;
}

/**
 * BIFMapping — a PROPOSAL to change BIF based on evidence.
 *
 * RULE: the RIE must NOT modify BIF directly. It only produces mapping
 * proposals; an upstream engine decides whether to apply them.
 */
export interface BIFMapping {
  readonly evidenceId: string;
  readonly target: BIFMappingTarget;
  readonly action: BIFMappingAction;
  /** 0–100. */
  readonly impactScore: number;
}
