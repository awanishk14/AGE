import type { OrganizationId } from './organization-id';
import type { ClientId } from './client-id';
import type { ProjectId } from './project-id';

/**
 * TenantScope — the Organization / Client / optional Project a trusted
 * request is bound to. Mirrors the ExecutionScope shape (@age/execution-contracts)
 * with branded ids; branded ids are plain strings at runtime, so a
 * TenantScope remains structurally assignable wherever an ExecutionScope
 * (organizationId/clientId/projectId as string) is expected.
 */
export interface TenantScope {
  readonly organizationId: OrganizationId;
  readonly clientId: ClientId;
  readonly projectId?: ProjectId;
}

/**
 * Deterministic equality for two TenantScope values. Two scopes are equal
 * when organizationId, clientId, and projectId (including "both absent")
 * all match.
 */
export function tenantScopesEqual(a: TenantScope, b: TenantScope): boolean {
  return (
    a.organizationId === b.organizationId &&
    a.clientId === b.clientId &&
    (a.projectId ?? null) === (b.projectId ?? null)
  );
}
