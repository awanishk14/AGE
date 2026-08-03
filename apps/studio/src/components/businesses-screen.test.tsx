import type { ClientRecord } from '@age/client-registry';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BusinessesScreen } from './businesses-screen';

const record = (clientId: string, organizationId: string): ClientRecord =>
  Object.freeze({
    clientId,
    organizationId,
    displayName: `Fictional ${clientId}`,
    externalRefs: {},
  });

describe('BusinessesScreen', () => {
  describe('when no record file is configured', () => {
    const view = { kind: 'not-configured', variable: 'AGE_CLIENT_RECORD_FILE' } as const;

    it('says AGE has not looked, and NOT that there are no businesses', () => {
      render(<BusinessesScreen view={view} />);

      expect(screen.getByText(/AGE has not looked for your businesses/)).toBeDefined();
      expect(screen.getByText(/This is not/)).toBeDefined();
      expect(screen.getByText(/Not assessed/)).toBeDefined();
    });

    it('names the variable the operator must set', () => {
      render(<BusinessesScreen view={view} />);
      expect(screen.getByText('AGE_CLIENT_RECORD_FILE')).toBeDefined();
    });

    it('shows NO count — not even zero', () => {
      // 🚫 The failure this whole screen exists to prevent: an unlooked-at
      // absence rendered as a measured zero.
      const { container } = render(<BusinessesScreen view={view} />);
      expect(container.textContent).not.toMatch(/\b0 businesses\b/);
    });

    it('does NOT offer Create a client — there is nowhere to write it', () => {
      // ⚠️ An action the operator cannot complete is worse than one that is
      // absent: the form would only refuse on submit.
      render(<BusinessesScreen view={view} />);
      expect(screen.queryByRole('link', { name: 'Create a client' })).toBeNull();
    });
  });

  describe('when the record file is refused', () => {
    it('shows the refusal rather than an empty list', () => {
      render(
        <BusinessesScreen
          view={{ kind: 'refused', reason: 'The record at position 2 is not a valid ClientRecord' }}
        />,
      );

      expect(screen.getByText(/The record file was refused/)).toBeDefined();
      expect(screen.getByText(/position 2/)).toBeDefined();
      expect(screen.getByText(/rather than a partial or repaired registry/)).toBeDefined();
    });

    it('shows no count for a read that did not happen', () => {
      const { container } = render(<BusinessesScreen view={{ kind: 'refused', reason: 'no' }} />);
      expect(container.textContent).not.toMatch(/businesses read/);
    });
  });

  describe('when the file names no businesses', () => {
    it('presents it as a result, distinct from not having looked', () => {
      render(<BusinessesScreen view={{ kind: 'none' }} />);

      expect(screen.getByText(/AGE looked, and the file names no businesses/)).toBeDefined();
      expect(screen.getByText(/a result, not a failure/)).toBeDefined();
      expect(screen.getByText('0 businesses read from the operator record file.')).toBeDefined();
    });

    it('offers Create a client — the way out of an empty file', () => {
      render(<BusinessesScreen view={{ kind: 'none' }} />);
      expect(screen.getByRole('link', { name: 'Create a client' }).getAttribute('href')).toBe(
        '/businesses/new',
      );
    });
  });

  describe('when businesses were read', () => {
    const view = {
      kind: 'listed',
      bands: [
        { organizationId: 'org-a', clients: [record('c-1', 'org-a'), record('c-2', 'org-a')] },
        { organizationId: 'org-b', clients: [record('c-3', 'org-b')] },
      ],
    } as const;

    it('lists every business under its own organization band', () => {
      render(<BusinessesScreen view={view} />);

      expect(screen.getByText('Fictional c-1')).toBeDefined();
      expect(screen.getByText('Fictional c-3')).toBeDefined();
      expect(screen.getAllByText(/^Organization/)).toHaveLength(2);
    });

    it('reports the count it actually read', () => {
      render(<BusinessesScreen view={view} />);
      expect(screen.getByText('3 businesses read from the operator record file.')).toBeDefined();
    });

    it('states that the organization band is not selectable', () => {
      // 🚫 An organization is a derived grouping, never a scope you can pick.
      render(<BusinessesScreen view={view} />);
      expect(screen.getAllByText(/not a scope you can select/).length).toBeGreaterThan(0);
    });

    it('gives the organization band NO link', () => {
      render(<BusinessesScreen view={view} />);

      for (const link of screen.getAllByRole('link')) {
        expect(link.getAttribute('href')).not.toMatch(/organization/i);
      }
    });

    it('links each business to its own scoped subject routes', () => {
      render(<BusinessesScreen view={view} />);

      const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
      expect(hrefs).toContain('/b/c-1/discovery');
      expect(hrefs).toContain('/b/c-3/bif');
      // ⚠️ No unscoped subject link may survive the migration.
      expect(hrefs.filter((href) => href === '/discovery')).toHaveLength(0);
    });

    it('says when a business has no mapped external systems', () => {
      // ⚠️ "No Meta ad account" is not "an empty Meta ad account".
      render(<BusinessesScreen view={view} />);
      expect(screen.getAllByText(/No external systems are mapped/).length).toBe(3);
    });

    it('shows mapped external references when there are some', () => {
      render(
        <BusinessesScreen
          view={{
            kind: 'listed',
            bands: [
              {
                organizationId: 'org-a',
                clients: [{ ...record('c-1', 'org-a'), externalRefs: { rankops: 'ro-9' } }],
              },
            ],
          }}
        />,
      );

      expect(screen.getByText('rankops')).toBeDefined();
      expect(screen.getByText('ro-9')).toBeDefined();
    });
  });

  it('never describes itself as read-only', () => {
    // 🚫 ADR-0057 §0.7 retired the term.
    const { container } = render(<BusinessesScreen view={{ kind: 'none' }} />);
    expect(container.textContent).not.toMatch(/read-only/i);
  });
});
