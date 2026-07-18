/**
 * @age/platform-context — Production Operator and Tenant Context Boundary
 * foundation (ADR-0024).
 *
 * Pure types and validating factories for trusted operator identity
 * (human | system) and tenant/client/project scope. This is a
 * foundation-only slice: no auth, no persistence, no execution, and no
 * change to any existing API/Web behavior. A TrustedOperatorTenantContext
 * is constructible only through the factories in ./factory — never a bare
 * object literal — so no anonymous or default context can exist.
 */
export type {
  OperatorId,
  OrganizationId,
  ClientId,
  ProjectId,
  OperatorActorKind,
  HumanOperatorContext,
  SystemActorContext,
  OperatorContext,
  TenantScope,
  TrustedOperatorTenantContext,
} from './types';
export { operatorId, organizationId, clientId, projectId, tenantScopesEqual } from './types';

export {
  createHumanOperatorContext,
  createSystemActorContext,
  createTenantScope,
  createTrustedOperatorTenantContext,
} from './factory';
export type {
  CreateOperatorContextInput,
  CreateTenantScopeInput,
  CreateTrustedContextInput,
} from './factory';
