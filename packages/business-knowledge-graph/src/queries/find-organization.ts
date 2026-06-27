import type { BusinessQuery } from '../interfaces/business-query';
import type { OrganizationNode } from '../nodes';

/** FindOrganization — placeholder query contract. No traversal logic. */
export type FindOrganization = BusinessQuery<OrganizationNode | null>;
