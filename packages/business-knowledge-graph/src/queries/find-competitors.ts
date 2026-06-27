import type { BusinessQuery } from '../interfaces/business-query';
import type { CompetitorNode } from '../nodes';

/** FindCompetitors — placeholder query contract. No traversal logic. */
export type FindCompetitors = BusinessQuery<readonly CompetitorNode[]>;
