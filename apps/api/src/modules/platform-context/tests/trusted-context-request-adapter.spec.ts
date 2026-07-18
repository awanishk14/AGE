import { describe, expect, it } from 'vitest';
import { createDemoTrustedContextFromRequestFields } from '../application/trusted-context-request-adapter';

describe('createDemoTrustedContextFromRequestFields', () => {
  it('builds a trusted context from valid explicit fields', () => {
    const context = createDemoTrustedContextFromRequestFields({
      organizationId: 'org-1',
      clientId: 'client-1',
      operatorId: 'user:owner-1',
    });

    expect(context.operator.kind).toBe('human');
    expect(context.operator.operatorId).toBe('user:owner-1');
    expect(context.scope.organizationId).toBe('org-1');
    expect(context.scope.clientId).toBe('client-1');
    expect(context.scope.projectId).toBeUndefined();
  });

  it('supports an optional projectId', () => {
    const context = createDemoTrustedContextFromRequestFields({
      organizationId: 'org-1',
      clientId: 'client-1',
      projectId: 'project-1',
      operatorId: 'user:owner-1',
    });

    expect(context.scope.projectId).toBe('project-1');
  });

  it('rejects an empty operatorId', () => {
    expect(() =>
      createDemoTrustedContextFromRequestFields({
        organizationId: 'org-1',
        clientId: 'client-1',
        operatorId: '',
      }),
    ).toThrow(/operatorId/);
  });

  it('rejects an empty organizationId', () => {
    expect(() =>
      createDemoTrustedContextFromRequestFields({
        organizationId: '',
        clientId: 'client-1',
        operatorId: 'user:owner-1',
      }),
    ).toThrow(/organizationId/);
  });

  it('rejects an empty clientId', () => {
    expect(() =>
      createDemoTrustedContextFromRequestFields({
        organizationId: 'org-1',
        clientId: '',
        operatorId: 'user:owner-1',
      }),
    ).toThrow(/clientId/);
  });

  it('never produces an anonymous/default operator — always a human context with the supplied operatorId', () => {
    const context = createDemoTrustedContextFromRequestFields({
      organizationId: 'org-1',
      clientId: 'client-1',
      operatorId: 'user:owner-2',
    });

    expect(context.operator.kind).not.toBe('system');
    expect(context.operator.operatorId).not.toBe('');
    expect(context.operator.operatorId).toBe('user:owner-2');
  });
});
