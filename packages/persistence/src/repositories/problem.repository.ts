import type { ProblemId } from '@age/shared';
import type { ProblemNode } from '@age/business-knowledge-graph';
import type { PersistenceRepository } from '../interfaces/persistence-repository';

/**
 * ProblemPersistenceRepository — persistence port for Problem. Interface only; no SQL.
 */
export type ProblemPersistenceRepository = PersistenceRepository<ProblemNode, ProblemId>;
