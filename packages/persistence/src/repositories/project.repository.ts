import type { ProjectId } from '@age/shared';
import type { ProjectNode } from '@age/business-knowledge-graph';
import type { PersistenceRepository } from '../interfaces/persistence-repository';

/**
 * ProjectPersistenceRepository — persistence port for Project. Interface only; no SQL.
 */
export type ProjectPersistenceRepository = PersistenceRepository<ProjectNode, ProjectId>;
