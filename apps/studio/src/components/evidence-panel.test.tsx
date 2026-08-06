import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EvidencePanel, type EvidenceOutcomeLike } from './evidence-panel';

/**
 * 🚫 Obviously fictional throughout. Real client answers are never committed
 * (ADR-0053 D3).
 */
const ledger = {
  namedEvidence: [
    {
      id: 'ev-documents-1',
      label: 'An invented brand guide',
      kind: 'document',
      state: 'unattributed' as const,
    },
    {
      id: 'ev-urls-1',
      label: 'https://example.invalid/nothing-is-fetched',
      kind: 'url',
      state: 'unattributed' as const,
    },
  ],
  recordedAnswers: [
    {
      questionId: 'ev-assumptions',
      prompt: 'What key assumptions or unknowns remain?',
      value: 'We assume imaginary kites keep breaking',
    },
  ],
  supportedBeliefs: [],
  unsupportedBeliefs: [
    {
      sectionName: 'Business Identity',
      fieldKey: 'legalName',
      state: 'unattributed' as const,
      confidence: 'USER_CONFIRMED',
      source: 'USER',
    },
  ],
  citedFieldPaths: [],
  unmappedFields: [
    { field: 'assumptions', reason: 'BIF has no field for an unverified assumption.' },
  ],
  notAssessed: [
    {
      label: 'External verification',
      state: 'not-assessed' as const,
      detail: 'AGE has not opened a document or fetched a web reference. Retrieval is refused.',
    },
  ],
};

function renderPanel(outcome: EvidenceOutcomeLike) {
  const assemble = vi.fn(
    async (_clientId: string, _changedBy: string): Promise<EvidenceOutcomeLike> => outcome,
  );
  render(<EvidencePanel clientId="fictional-co" assemble={assemble} />);
  return assemble;
}

/** Type a principal and press. The only path to a ledger. */
function press() {
  fireEvent.change(screen.getByLabelText('Recorded by'), {
    target: { value: 'operator:fictional' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Assemble evidence' }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EvidencePanel', () => {
  it('assembles nothing until the operator presses', async () => {
    // 🚫 THE ONE THAT MATTERS. A recompute-on-open is class 3 under ADR-0057 D4
    // even though its effect is entirely internal.
    const assemble = renderPanel({ kind: 'assembled', view: ledger, organizationId: 'org' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Assemble evidence' })).toBeTruthy();
    });
    expect(assemble).not.toHaveBeenCalled();
  });

  it('refuses to run without a principal, and never invents one', () => {
    const assemble = renderPanel({ kind: 'assembled', view: ledger, organizationId: 'org' });
    const button = screen.getByRole('button', { name: 'Assemble evidence' }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(assemble).not.toHaveBeenCalled();
  });

  it('offers no way to open, fetch or verify a source', async () => {
    // 🚫 THE REFUSAL THIS SCREEN IS ABOUT. Retrieval is class 3; a link is one
    // press away from a retrieval, so a named source is rendered as text.
    renderPanel({ kind: 'assembled', view: ledger, organizationId: 'org' });

    press();

    await waitFor(() =>
      expect(screen.getByText('https://example.invalid/nothing-is-fetched')).toBeTruthy(),
    );
    expect(screen.queryByRole('link', { name: /example\.invalid/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /verify|fetch|open/i })).toBeNull();
  });

  it('says naming a source is not verifying it', async () => {
    renderPanel({ kind: 'assembled', view: ledger, organizationId: 'org' });

    press();

    await waitFor(() => expect(screen.getByText(/Named, not verified/i)).toBeTruthy());
  });

  it('reports no supported belief as the correct result, not as an empty list', async () => {
    renderPanel({ kind: 'assembled', view: ledger, organizationId: 'org' });

    press();

    await waitFor(() =>
      expect(screen.getByText(/correct result for a first discovery run/i)).toBeTruthy(),
    );
  });

  it('says an unsupported belief is not a doubted one', async () => {
    // 🚫 Unknown is never converted into bad. An uncorroborated claim is not
    // evidence against the business.
    renderPanel({ kind: 'assembled', view: ledger, organizationId: 'org' });

    press();

    await waitFor(() => expect(screen.getByText(/Unsupported is not doubted/i)).toBeTruthy());
  });

  it('says nothing has been read, rather than showing an empty ledger', () => {
    renderPanel({ kind: 'no-answer-file' });
    expect(screen.getByText(/nothing has been read/i)).toBeTruthy();
  });

  it('explains a missing answer file rather than assembling an empty ledger', async () => {
    renderPanel({ kind: 'no-answer-file' });

    press();

    await waitFor(() => expect(screen.getByText('Discovery has not been submitted')).toBeTruthy());
  });

  it('surfaces a refusal as a refusal', async () => {
    renderPanel({ kind: 'refused', reason: 'The answer file could not be parsed.' });

    press();

    await waitFor(() => expect(screen.getByText('Refused')).toBeTruthy());
    expect(screen.getByText('The answer file could not be parsed.')).toBeTruthy();
  });
});
