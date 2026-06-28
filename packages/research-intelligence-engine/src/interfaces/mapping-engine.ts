import type { Evidence } from '../evidence/evidence';
import type { BIFMapping } from '../mapping/bif-mapping';

/**
 * MappingEngine — produces BIF mapping PROPOSALS from evidence.
 * RIE must NOT modify BIF directly. Interface only.
 */
export interface MappingEngine {
  propose(evidence: Evidence): readonly BIFMapping[];
}
