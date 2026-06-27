import type { ResearchId } from '@age/shared';
import type { ResearchNode } from '@age/business-knowledge-graph';
import type { PersistenceRepository } from '../interfaces/persistence-repository';

/**
 * ResearchPersistenceRepository — persistence port for Research. Interface only; no SQL.
 */
export type ResearchPersistenceRepository = PersistenceRepository<ResearchNode, ResearchId>;
