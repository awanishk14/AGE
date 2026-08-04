import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BifPanel, type GenerateBifOutcomeLike } from './bif-panel';

/**
 * 🚫 Obviously fictional throughout. Real client answers are never committed
 * (ADR-0053 D3).
 */
const generatedView = {
  bifId: 'bif-fictional',
  bifStatus: 'Draft',
  scores: {
    discoveryCompletenessScore: 41,
    discoveryConfidenceScore: 52,
    bifCompletenessScore: 12,
    bifConfidenceScore: 17,
  },
  completenessScore: 12,
  confidenceScore: 17,
  scoringVersion: 'bif-confidence-scoring-v1',
  sections: [
    {
      id: 'section-identity',
      name: 'Business Identity',
      type: 'BUSINESS_IDENTITY',
      confidenceScore: 60,
      completenessScore: 50,
      fields: [
        {
          key: 'legalName',
          type: 'TEXT',
          value: 'Fictional Kite Repair',
          state: 'unattributed' as const,
          confidence: 'USER_CONFIRMED',
          source: 'USER',
          required: true,
        },
      ],
    },
  ],
  omittedSections: [
    { name: 'Competitive Landscape', type: 'COMPETITIVE_LANDSCAPE', state: 'unknown' as const },
  ],
  unmappedFields: [{ field: 'ev-urls', reason: 'No BIF field carries evidence URLs yet.' }],
  presentSectionCount: 1,
  omittedSectionCount: 1,
};

function renderPanel(outcome: GenerateBifOutcomeLike) {
  const generate = vi.fn(
    async (_clientId: string, _changedBy: string): Promise<GenerateBifOutcomeLike> => outcome,
  );
  render(<BifPanel clientId="fictional-co" generate={generate} />);
  return generate;
}

/** Type a principal and press. The only path to a produced BIF. */
function press() {
  fireEvent.change(screen.getByLabelText('Recorded by'), {
    target: { value: 'operator:fictional' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Generate BIF' }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BifPanel', () => {
  it('produces nothing until the operator presses', async () => {
    // 🚫 THE ONE THAT MATTERS. A recompute-on-open is class 3 under ADR-0057 D4
    // even though its effect is entirely internal — it is the case that gets
    // argued away, so it is asserted directly.
    const generate = renderPanel({ kind: 'generated', view: generatedView, organizationId: 'org' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generate BIF' })).toBeTruthy();
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('says nothing has been run, rather than showing an empty BIF', () => {
    // ⚠️ Not "this business has no BIF" — nothing has looked.
    renderPanel({ kind: 'no-answer-file' });
    expect(screen.getByText(/nothing has been run/i)).toBeTruthy();
  });

  it('refuses to run without a principal, and never invents one', async () => {
    // 🚫 ADR-0053 D4: an OperatorPrincipal is never defaulted, generated or
    // inferred. A disabled button is the honest consequence.
    const generate = renderPanel({ kind: 'generated', view: generatedView, organizationId: 'org' });
    const button = screen.getByRole('button', { name: 'Generate BIF' }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect((screen.getByLabelText('Recorded by') as HTMLInputElement).value).toBe('');

    fireEvent.click(button);
    expect(generate).not.toHaveBeenCalled();
  });

  it('passes the typed principal through untouched', async () => {
    const generate = renderPanel({ kind: 'generated', view: generatedView, organizationId: 'org' });

    press();

    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect(generate.mock.calls[0]?.[1]).toBe('operator:fictional');
  });

  it('shows the four scores as four, and invents no headline number', async () => {
    // ⚠️ Intake completeness and BIF completeness measure different things.
    // 🚫 Averaging them would hide exactly the gap between them.
    renderPanel({ kind: 'generated', view: generatedView, organizationId: 'org' });

    press();

    await waitFor(() => expect(screen.getByText('Intake completeness')).toBeTruthy());
    expect(screen.getByText('Intake confidence')).toBeTruthy();
    expect(screen.getByText('BIF completeness')).toBeTruthy();
    expect(screen.getByText('BIF confidence')).toBeTruthy();
    expect(screen.queryByText(/overall score/i)).toBeNull();
  });

  it('never claims the produced BIF was saved', async () => {
    // 🚫 Nothing is persisted and nothing here can persist. A screen implying
    // otherwise would have the operator believe AGE holds a record it does not.
    renderPanel({ kind: 'generated', view: generatedView, organizationId: 'org' });

    press();

    await waitFor(() => expect(screen.getByText('Produced BIF')).toBeTruthy());
    expect(screen.getByText(/Nothing is saved/i)).toBeTruthy();
    expect(screen.getByText(/not a stored snapshot/i)).toBeTruthy();
  });

  it('shows an omitted section as a limit of capture, not as a finding', async () => {
    // 🚫 ADR-0026 D4: a missing section is a limitation, never negative
    // evidence about the business.
    renderPanel({ kind: 'generated', view: generatedView, organizationId: 'org' });

    press();

    await waitFor(() => expect(screen.getByText(/Competitive Landscape/)).toBeTruthy());
    expect(screen.getByText(/nothing here counts against it/i)).toBeTruthy();
  });

  it('explains a missing answer file rather than producing an empty BIF', async () => {
    renderPanel({ kind: 'no-answer-file' });

    press();

    await waitFor(() => expect(screen.getByText('Discovery has not been submitted')).toBeTruthy());
    // ⚠️ A draft is not an answer file, and the screen says why.
    expect(screen.getByText(/a draft is unfinished by definition/i)).toBeTruthy();
  });

  it('surfaces a refusal as a refusal', async () => {
    renderPanel({ kind: 'refused', reason: 'The answer file could not be parsed.' });

    press();

    await waitFor(() => expect(screen.getByText('Refused')).toBeTruthy());
    expect(screen.getByText('The answer file could not be parsed.')).toBeTruthy();
  });
});
