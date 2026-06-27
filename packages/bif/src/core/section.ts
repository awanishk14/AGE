import type { BIFField, BIFFieldDefinition } from './field';
import type { SectionType } from './section-type';

/**
 * BIFSection — a coherent group of fields (e.g. Organization Identity).
 */
export interface BIFSection {
  readonly id: string;
  readonly type: SectionType;
  readonly name: string;
  readonly fields: readonly BIFField[];
  /** 0–100. */
  readonly confidenceScore: number;
  /** 0–100. */
  readonly completenessScore: number;
  readonly lastVerifiedAt: Date;
}

/**
 * BIFSectionDefinition — the static schema of a section: its type, display name
 * and the set of field definitions it contains.
 */
export interface BIFSectionDefinition {
  readonly type: SectionType;
  readonly name: string;
  readonly fields: readonly BIFFieldDefinition[];
}
