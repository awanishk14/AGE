import { describe, expect, it } from 'vitest';

import { authenticatedOrganizationIdOf, SessionRefusedError } from '@age/entitlement';

import {
  assertPathWithinTenantWorkspace,
  deriveTenantWorkspaceRoot,
  OperatorFilePathRefusedError,
  TenantWorkspaceRefusedError,
} from '../index';

const DEPLOYMENT_ROOT = '/srv/age/workspaces';
const REPOSITORY_ROOT = '/srv/age/checkout';

function organization(organizationId: string) {
  return authenticatedOrganizationIdOf({
    sessionId: 'ses-fictional-1',
    organizationId,
    accountId: 'acct-fictional-1',
  });
}

function derive(
  organizationId: string,
  overrides: Partial<{ deploymentWorkspaceRoot: string }> = {},
) {
  return deriveTenantWorkspaceRoot({
    deploymentWorkspaceRoot: DEPLOYMENT_ROOT,
    organizationId: organization(organizationId),
    repositoryRoot: REPOSITORY_ROOT,
    ...overrides,
  });
}

describe('deriveTenantWorkspaceRoot (ADR-0061 A4)', () => {
  it('derives one directory per organization', () => {
    expect(derive('org-fictional-1')).toBe('/srv/age/workspaces/org-fictional-1');
  });

  it('gives two organizations two roots, neither inside the other', () => {
    const a = derive('org-fictional-1');
    const b = derive('org-fictional-2');

    expect(a).not.toBe(b);
    expect(b.startsWith(`${a}/`)).toBe(false);
    expect(a.startsWith(`${b}/`)).toBe(false);
  });

  it('tolerates a trailing separator and Windows separators on the deployment root', () => {
    expect(
      derive('org-fictional-1', { deploymentWorkspaceRoot: 'C:\\srv\\age\\workspaces\\' }),
    ).toBe('C:/srv/age/workspaces/org-fictional-1');
  });

  it.each([
    ['..', 'the classic traversal'],
    ['../org-fictional-2', 'a traversal wearing an identifier'],
    ['org/../../etc', 'a traversal in the middle'],
    ['org-fictional-1/nested', 'a separator'],
    ['org%2e%2e', 'an encoded traversal the allow-list never has to know about'],
    ['Org-Fictional-1', 'upper case, which two filesystems disagree about'],
    ['-leading-hyphen', 'a leading hyphen, which reads as a flag to some tools'],
    ['a', 'a single character, too short to be an identifier'],
  ])('refuses %s (%s)', (identifier) => {
    expect(() => derive(identifier)).toThrow(TenantWorkspaceRefusedError);
  });

  it.each([
    ['', 'nothing at all'],
    ['   ', 'whitespace'],
  ])('refuses %s (%s) EARLIER, at the session boundary', (identifier) => {
    // ⚠️ A blank organization never reaches the path arithmetic: it is refused
    // where a session is accepted, which is the earlier and better place.
    expect(() => derive(identifier)).toThrow(SessionRefusedError);
  });

  it('names no identifier when it refuses one', () => {
    // 🚫 An organization identifier in a log is a real tenant named in a log.
    try {
      derive('../org-fictional-2');
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain('fictional');
    }
  });

  it('refuses a blank deployment root rather than defaulting one', () => {
    expect(() => derive('org-fictional-1', { deploymentWorkspaceRoot: '  ' })).toThrow(
      TenantWorkspaceRefusedError,
    );
  });

  it('refuses a derived root inside the repository, through the ONE shared rule', () => {
    // ⚠️ ADR-0054 D3 — the outside-the-repository rule is imported, not copied.
    // This asserts the imported refusal is what fires, by its own error type.
    expect(() =>
      deriveTenantWorkspaceRoot({
        deploymentWorkspaceRoot: `${REPOSITORY_ROOT}/workspaces`,
        organizationId: organization('org-fictional-1'),
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).toThrow(OperatorFilePathRefusedError);
  });

  it('refuses a relative deployment root, through the same shared rule', () => {
    expect(() => derive('org-fictional-1', { deploymentWorkspaceRoot: 'workspaces' })).toThrow(
      OperatorFilePathRefusedError,
    );
  });
});

describe('assertPathWithinTenantWorkspace', () => {
  const ROOT = '/srv/age/workspaces/org-fictional-1';

  it('accepts the root itself and anything under it', () => {
    expect(() => assertPathWithinTenantWorkspace(ROOT, ROOT, 'answer file')).not.toThrow();
    expect(() =>
      assertPathWithinTenantWorkspace(`${ROOT}/intake/answers.json`, ROOT, 'answer file'),
    ).not.toThrow();
  });

  it('refuses a climb into another tenant, judged AFTER normalization', () => {
    // 🛑 The one that matters. `..` is not searched for as a character sequence —
    // the path is resolved and refused for where it arrives.
    expect(() =>
      assertPathWithinTenantWorkspace(
        `${ROOT}/../org-fictional-2/answers.json`,
        ROOT,
        'answer file',
      ),
    ).toThrow(TenantWorkspaceRefusedError);
  });

  it('refuses a sibling whose name merely starts with the root', () => {
    // ⚠️ A plain `startsWith` would accept `/srv/age/workspaces/org-fictional-10`
    // as being inside `…/org-fictional-1`.
    expect(() =>
      assertPathWithinTenantWorkspace(
        '/srv/age/workspaces/org-fictional-10/x',
        ROOT,
        'answer file',
      ),
    ).toThrow(TenantWorkspaceRefusedError);
  });

  it('refuses an unrelated absolute path', () => {
    expect(() => assertPathWithinTenantWorkspace('/etc/passwd', ROOT, 'answer file')).toThrow(
      TenantWorkspaceRefusedError,
    );
  });

  it('names neither path when it refuses', () => {
    try {
      assertPathWithinTenantWorkspace('/srv/age/workspaces/org-fictional-2/x', ROOT, 'answer file');
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain('fictional');
      expect((error as Error).message).toContain('answer file');
    }
  });

  it('requires a subject and a root', () => {
    expect(() => assertPathWithinTenantWorkspace(`${ROOT}/x`, ROOT, '  ')).toThrow(
      TenantWorkspaceRefusedError,
    );
    expect(() => assertPathWithinTenantWorkspace(`${ROOT}/x`, '  ', 'answer file')).toThrow(
      TenantWorkspaceRefusedError,
    );
  });
});
