import { organizationId } from '../types/organization-id';
import { clientId } from '../types/client-id';
import { projectId } from '../types/project-id';
import type { TenantScope } from '../types/tenant-scope';

export interface CreateTenantScopeInput {
  readonly organizationId: string;
  readonly clientId: string;
  readonly projectId?: string;
}

export function createTenantScope(input: CreateTenantScopeInput): TenantScope {
  return {
    organizationId: organizationId(input.organizationId),
    clientId: clientId(input.clientId),
    ...(input.projectId === undefined ? {} : { projectId: projectId(input.projectId) }),
  };
}
