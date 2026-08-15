import type { ClientRecord } from '@age/client-registry';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BusinessScope } from '@/server/operator-environment';

const resolveBusinessScope =
  vi.fn<(entitledOrganizationId: string, clientId: string) => BusinessScope>();

vi.mock('@/server/operator-environment', () => ({
  resolveBusinessScope: (entitledOrganizationId: string, clientId: string) =>
    resolveBusinessScope(entitledOrganizationId, clientId),
}));

const { SubjectAreaScreen } = await import('./subject-area-screen');

const client: ClientRecord = Object.freeze({
  clientId: 'c-1',
  organizationId: 'org-a',
  displayName: 'Fictional c-1',
  externalRefs: {},
});

describe('SubjectAreaScreen', () => {
  beforeEach(() => {
    resolveBusinessScope.mockReset();
  });

  describe('when the business resolves', () => {
    beforeEach(() => {
      resolveBusinessScope.mockReturnValue({ kind: 'resolved', client });
    });

    it('names the business and its organization on the screen', () => {
      // ⚠️ A scope shown in the URL but not on the page is easy to misread.
      render(<SubjectAreaScreen area="history" entitledOrganizationId="org-a" clientId="c-1" />);

      expect(screen.getByText('Fictional c-1')).toBeDefined();
      expect(screen.getByText('(c-1)')).toBeDefined();
      expect(screen.getByText('org-a')).toBeDefined();
    });

    it('still says the area is not wired, and why', () => {
      render(<SubjectAreaScreen area="history" entitledOrganizationId="org-a" clientId="c-1" />);

      expect(screen.getByText('This screen is not wired yet')).toBeDefined();
      expect(screen.getByText(/ADR-0055 D7/)).toBeDefined();
      expect(screen.getByText(/Not assessed/)).toBeDefined();
    });

    it('keeps every sibling link inside the same business', () => {
      render(<SubjectAreaScreen area="history" entitledOrganizationId="org-a" clientId="c-1" />);

      const scoped = screen
        .getAllByRole('link')
        .map((link) => link.getAttribute('href') ?? '')
        .filter((href) => href.startsWith('/b/'));

      expect(scoped.length).toBeGreaterThan(5);
      for (const href of scoped) {
        expect(href.startsWith('/b/c-1/')).toBe(true);
      }
    });
  });

  describe('when the clientId is not in the record file', () => {
    it('REFUSES rather than rendering a business with no data', () => {
      // 🚫 The load-bearing case. An unknown business must never render as a
      // real business that happens to be empty.
      resolveBusinessScope.mockReturnValue({ kind: 'unknown-client', clientId: 'ghost' });

      render(<SubjectAreaScreen area="history" entitledOrganizationId="org-a" clientId="ghost" />);

      expect(screen.getByText(/No record carries that business/)).toBeDefined();
      expect(screen.getByText(/a scope into circulation that names nothing/)).toBeDefined();
      expect(screen.queryByText('This screen is not wired yet')).toBeNull();
    });

    it('does not list the other businesses in the refusal', () => {
      // 🚫 The requested id is the operator's own; the others are other
      // clients' names and must not appear in a refusal.
      resolveBusinessScope.mockReturnValue({ kind: 'unknown-client', clientId: 'ghost' });

      const { container } = render(
        <SubjectAreaScreen area="history" entitledOrganizationId="org-a" clientId="ghost" />,
      );
      expect(container.textContent).not.toContain('Fictional');
    });
  });

  describe('when no record file is configured', () => {
    it('says no business can be resolved, not that the business is empty', () => {
      resolveBusinessScope.mockReturnValue({
        kind: 'not-configured',
        variable: 'AGE_CLIENT_RECORD_FILE',
      });

      render(<SubjectAreaScreen area="discovery" entitledOrganizationId="org-a" clientId="c-1" />);

      expect(screen.getByText(/The business could not be resolved/)).toBeDefined();
      expect(screen.getByText('AGE_CLIENT_RECORD_FILE')).toBeDefined();
      expect(screen.queryByText('This screen is not wired yet')).toBeNull();
    });
  });

  describe('when the record file was refused', () => {
    it('surfaces the refusal on the subject screen too', () => {
      resolveBusinessScope.mockReturnValue({
        kind: 'refused',
        reason: 'The record at position 2 is not a valid ClientRecord',
      });

      render(<SubjectAreaScreen area="history" entitledOrganizationId="org-a" clientId="c-1" />);

      expect(screen.getByText(/position 2/)).toBeDefined();
    });
  });
});
