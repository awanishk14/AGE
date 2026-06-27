import type { BusinessQuery } from '../interfaces/business-query';
import type { EvidenceNode } from '../nodes';

/** FindEvidence — placeholder query contract. No traversal logic. */
export type FindEvidence = BusinessQuery<readonly EvidenceNode[]>;
