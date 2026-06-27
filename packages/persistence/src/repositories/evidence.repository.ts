import type { EvidenceId } from '@age/shared';
import type { EvidenceNode } from '@age/business-knowledge-graph';
import type { PersistenceRepository } from '../interfaces/persistence-repository';

/**
 * EvidencePersistenceRepository — persistence port for Evidence. Interface only; no SQL.
 */
export type EvidencePersistenceRepository = PersistenceRepository<EvidenceNode, EvidenceId>;
