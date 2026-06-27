import type { BusinessQuery } from '../interfaces/business-query';
import type { ResearchNode } from '../nodes';

/** FindResearch — placeholder query contract. No traversal logic. */
export type FindResearch = BusinessQuery<readonly ResearchNode[]>;
