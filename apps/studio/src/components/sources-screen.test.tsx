import type { ClientRecord } from '@age/client-registry';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BusinessScope } from '@/server/operator-environment';

/**
 * ⚠️ WHAT THIS PROVES THAT THE `studio-shell` SPEC DOES NOT: that the sentence
 * naming the Sources boundary actually REACHES THE OPERATOR. A decision no
 * screen renders is a decision nobody is told.
 */

const resolveBusinessScope = vi.fn<(clientId: string) => BusinessScope>();

vi.mock('@/server/operator-environment', () => ({
  resolveBusinessScope: (clientId: string) => resolveBusinessScope(clientId),
  STUDIO_QUESTIONNAIRE: { sections: [] },
}));

vi.mock('@/server/sources-actions', () => ({
  readSourceDocumentAction: vi.fn(),
  recordPassageAction: vi.fn(),
}));

const { SourcesScreen } = await import('./sources-screen');

const CLIENT: ClientRecord = Object.freeze({
  clientId: 'fictional-client-1',
  organizationId: 'org-fictional-1',
  displayName: 'A Fictional Business',
  externalRefs: {},
});

describe('SourcesScreen', () => {
  beforeEach(() => {
    resolveBusinessScope.mockReset();
    resolveBusinessScope.mockReturnValue({ kind: 'resolved', client: CLIENT });
  });

  it('names its own boundary and points at the area that holds the other answer', () => {
    render(<SourcesScreen clientId="fictional-client-1" />);

    expect(screen.getByText(/documents only/i)).toBeDefined();
    expect(screen.getByText(/the operator relays it/i)).toBeDefined();
  });

  it('🚫 does not render the relayed observations here — the answer stays in one place', () => {
    render(<SourcesScreen clientId="fictional-client-1" />);

    // 🛑 A second copy of "what did a source report" would be a second truth,
    // and the copy that drifts still looks authoritative. Sources points; it
    // does not repeat. The panel's own heading must be absent.
    expect(screen.queryByText(/what each source system reported/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /relay/i })).toBeNull();
  });

  it('🚫 never says nobody has reported — from here AGE has not looked', () => {
    render(<SourcesScreen clientId="fictional-client-1" />);

    for (const forbidden of [
      /no source systems/i,
      /no observations/i,
      /nothing has been reported/i,
      /all clear/i,
    ]) {
      expect(screen.queryByText(forbidden), String(forbidden)).toBeNull();
    }
  });
});
