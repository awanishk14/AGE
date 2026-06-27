import type { BusinessQuery } from '../interfaces/business-query';
import type { ProjectNode } from '../nodes';

/** FindProjects — placeholder query contract. No traversal logic. */
export type FindProjects = BusinessQuery<readonly ProjectNode[]>;
