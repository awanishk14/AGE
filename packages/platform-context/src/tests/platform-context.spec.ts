import { describe, expect, it } from 'vitest';
import {
  createHumanOperatorContext,
  createSystemActorContext,
  createTenantScope,
  createTrustedOperatorTenantContext,
  tenantScopesEqual,
} from '../index';

describe('operator context', () => {
  it('builds a valid human operator context', () => {
    const context = createHumanOperatorContext({ operatorId: 'user:owner-1' });
    expect(context.kind).toBe('human');
    expect(context.operatorId).toBe('user:owner-1');
  });

  it('builds a valid system actor context, distinguishable from a human one', () => {
    const context = createSystemActorContext({ operatorId: 'system:scheduler' });
    expect(context.kind).toBe('system');
    expect(context.operatorId).toBe('system:scheduler');
    expect(context.kind).not.toBe('human');
  });

  it('rejects an empty operatorId for a human context', () => {
    expect(() => createHumanOperatorContext({ operatorId: '' })).toThrow(/operatorId/);
  });

  it('rejects an empty operatorId for a system context', () => {
    expect(() => createSystemActorContext({ operatorId: '   ' })).toThrow(/operatorId/);
  });
});

describe('tenant scope', () => {
  it('builds a valid scope with organizationId and clientId only', () => {
    const scope = createTenantScope({ organizationId: 'org-1', clientId: 'client-1' });
    expect(scope.organizationId).toBe('org-1');
    expect(scope.clientId).toBe('client-1');
    expect(scope.projectId).toBeUndefined();
  });

  it('builds a valid scope with an optional projectId', () => {
    const scope = createTenantScope({
      organizationId: 'org-1',
      clientId: 'client-1',
      projectId: 'project-1',
    });
    expect(scope.projectId).toBe('project-1');
  });

  it('rejects an empty organizationId', () => {
    expect(() => createTenantScope({ organizationId: '', clientId: 'client-1' })).toThrow(
      /organizationId/,
    );
  });

  it('rejects an empty clientId', () => {
    expect(() => createTenantScope({ organizationId: 'org-1', clientId: '' })).toThrow(/clientId/);
  });

  it('deterministically compares two scopes for equality', () => {
    const a = createTenantScope({ organizationId: 'org-1', clientId: 'client-1' });
    const b = createTenantScope({ organizationId: 'org-1', clientId: 'client-1' });
    const c = createTenantScope({
      organizationId: 'org-1',
      clientId: 'client-1',
      projectId: 'project-1',
    });
    const d = createTenantScope({ organizationId: 'org-2', clientId: 'client-1' });

    expect(tenantScopesEqual(a, b)).toBe(true);
    expect(tenantScopesEqual(a, c)).toBe(false);
    expect(tenantScopesEqual(a, d)).toBe(false);
  });
});

describe('trusted operator/tenant context', () => {
  it('builds a valid context for a human operator', () => {
    const context = createTrustedOperatorTenantContext({
      operatorKind: 'human',
      operator: { operatorId: 'user:owner-1' },
      scope: { organizationId: 'org-1', clientId: 'client-1' },
    });

    expect(context.operator.kind).toBe('human');
    expect(context.operator.operatorId).toBe('user:owner-1');
    expect(context.scope.organizationId).toBe('org-1');
    expect(context.scope.clientId).toBe('client-1');
  });

  it('builds a valid context for a system actor', () => {
    const context = createTrustedOperatorTenantContext({
      operatorKind: 'system',
      operator: { operatorId: 'system:scheduler' },
      scope: { organizationId: 'org-1', clientId: 'client-1', projectId: 'project-1' },
    });

    expect(context.operator.kind).toBe('system');
    expect(context.scope.projectId).toBe('project-1');
  });

  it('rejects an empty operatorId', () => {
    expect(() =>
      createTrustedOperatorTenantContext({
        operatorKind: 'human',
        operator: { operatorId: '' },
        scope: { organizationId: 'org-1', clientId: 'client-1' },
      }),
    ).toThrow(/operatorId/);
  });

  it('rejects an empty organizationId', () => {
    expect(() =>
      createTrustedOperatorTenantContext({
        operatorKind: 'human',
        operator: { operatorId: 'user:owner-1' },
        scope: { organizationId: '', clientId: 'client-1' },
      }),
    ).toThrow(/organizationId/);
  });

  it('rejects an empty clientId', () => {
    expect(() =>
      createTrustedOperatorTenantContext({
        operatorKind: 'human',
        operator: { operatorId: 'user:owner-1' },
        scope: { organizationId: 'org-1', clientId: '' },
      }),
    ).toThrow(/clientId/);
  });

  it('has no anonymous/default construction path — only the validating factory produces a context', () => {
    expect(typeof createTrustedOperatorTenantContext).toBe('function');
    expect(createTrustedOperatorTenantContext).not.toHaveProperty('default');
  });
});
