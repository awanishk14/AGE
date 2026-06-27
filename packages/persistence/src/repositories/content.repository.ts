import type { ContentId } from '@age/shared';
import type { ContentNode } from '@age/business-knowledge-graph';
import type { PersistenceRepository } from '../interfaces/persistence-repository';

/**
 * ContentPersistenceRepository — persistence port for Content. Interface only; no SQL.
 */
export type ContentPersistenceRepository = PersistenceRepository<ContentNode, ContentId>;
