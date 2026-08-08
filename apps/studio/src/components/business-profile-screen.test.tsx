import type { ClientRecord } from '@age/client-registry';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BusinessScope, DraftOutcome } from '@/server/operator-environment';

const resolveBusinessScope = vi.fn<(clientId: string) => BusinessScope>();
const readDiscoveryDraft = vi.fn<(clientId: string) => DraftOutcome>();

vi.mock('@/server/operator-environment', () => ({
  resolveBusinessScope: (clientId: string) => resolveBusinessScope(clientId),
  readDiscoveryDraft: (clientId: string) => readDiscoveryDraft(clientId),
}));

const { BusinessProfileScreen } = await import('./business-profile-screen');

const client: ClientRecord = Object.freeze({
  clientId: 'c-1',
  organizationId: 'org-a',
  displayName: 'Fictional c-1',
  externalRefs: {},
});

const emptyDraft = Object.freeze({ answers: {}, skips: {} }) as never;

describe('BusinessProfileScreen', () => {
  beforeEach(() => {
    resolveBusinessScope.mockReset();
    readDiscoveryDraft.mockReset();
    resolveBusinessScope.mockReturnValue({ kind: 'resolved', client });
    readDiscoveryDraft.mockReturnValue({ kind: 'loaded', draft: emptyDraft, everSaved: true });
  });

  /**
   * 🛑 THE ORDER IS LOAD-BEARING. A page rendered before the scope is checked
   * has already told the operator that business exists.
   */
  it('refuses the profile for a business no record carries, and reads no draft', () => {
    resolveBusinessScope.mockReturnValue({ kind: 'unknown-client', clientId: 'ghost' });

    render(<BusinessProfileScreen clientId="ghost" />);

    expect(screen.getByText('No record carries that business')).toBeDefined();
    expect(readDiscoveryDraft).not.toHaveBeenCalled();
  });

  it('says a workspace was never configured without calling it "no answers"', () => {
    readDiscoveryDraft.mockReturnValue({ kind: 'not-configured', variable: 'AGE_X' });

    render(<BusinessProfileScreen clientId="c-1" />);

    expect(screen.getByText('Not looked for')).toBeDefined();
    expect(screen.getByText(/nothing has looked/)).toBeDefined();
  });

  /**
   * 🛑 `everSaved` IS THE WHOLE DISTINCTION. An empty form that was never saved
   * is 🚫 not a draft that was read and found blank.
   */
  it('separates a draft never saved from one that was', () => {
    readDiscoveryDraft.mockReturnValue({ kind: 'loaded', draft: emptyDraft, everSaved: false });
    const neverSaved = render(<BusinessProfileScreen clientId="c-1" />);
    expect(screen.getByText('Nothing saved yet')).toBeDefined();
    neverSaved.unmount();

    readDiscoveryDraft.mockReturnValue({ kind: 'loaded', draft: emptyDraft, everSaved: true });
    render(<BusinessProfileScreen clientId="c-1" />);
    expect(screen.getByText('A draft has been saved')).toBeDefined();
  });

  it('never reads a saved draft as a finished Discovery', () => {
    render(<BusinessProfileScreen clientId="c-1" />);

    expect(screen.getByText(/A saved draft is not submitted answers/)).toBeDefined();
    expect(screen.getByText(/no snapshot of this business exists/)).toBeDefined();
  });

  it('shows the no-checklist notice on the surface, not as a footnote', () => {
    render(<BusinessProfileScreen clientId="c-1" />);

    expect(screen.getByText(/are not a checklist and do not add up to a score/)).toBeDefined();
  });

  it('links every subject area under this business', () => {
    render(<BusinessProfileScreen clientId="c-1" />);

    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    let checked = 0;
    for (const tail of [
      'discovery',
      'bif',
      'evidence',
      'contradictions',
      'intelligence',
      'strategy',
      'execution',
      'history',
      'peer-products',
    ]) {
      expect(links, `no link to ${tail}`).toContain(`/b/c-1/${tail}`);
      checked += 1;
    }
    expect(checked).toBe(9);
  });

  it('states an unwired area is not assessed, with its reason, never as empty', () => {
    render(<BusinessProfileScreen clientId="c-1" />);

    expect(screen.getAllByText('Not assessed').length).toBeGreaterThan(0);
    expect(screen.getByText(/ADR-0055 D7/)).toBeDefined();
  });
});
