import type { BusinessQuery } from '../interfaces/business-query';
import type { ContentNode } from '../nodes';

/** FindContent — placeholder query contract. No traversal logic. */
export type FindContent = BusinessQuery<readonly ContentNode[]>;
