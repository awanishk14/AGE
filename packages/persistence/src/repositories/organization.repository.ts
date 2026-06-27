import type { OrganizationId } from '@age/shared';
import type { OrganizationNode } from '@age/business-knowledge-graph';
import type { PersistenceRepository } from '../interfaces/persistence-repository';

/**
 * OrganizationPersistenceRepository — persistence port for Organization. Interface only; no SQL.
 */
export type OrganizationPersistenceRepository = PersistenceRepository<
  OrganizationNode,
  OrganizationId
>;
