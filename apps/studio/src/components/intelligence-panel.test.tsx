import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IntelligencePanel, type CapabilityReadinessOutcomeLike } from './intelligence-panel';

/**
 * 🚫 Obviously fictional throughout. Real client answers are never committed
 * (ADR-0053 D3).
 *
 * ⚠️ One adopter and one non-adopter, deliberately — the pair the screen must
 * never render alike.
 */
const view = {
  incommensurabilityNotice: [
    'Each assessment judges a different set of BIF sections against its own thresholds.',
    'These states cannot be added, averaged or ranked against one another.',
  ],
  rows: [
    {
      capabilityName: 'Market Discovery',
      declaration: 'An invented declaration.',
      state: 'known' as const,
      assessedState: 'insufficient',
      reasons: ['Root BIF confidence is below the published floor.'],
      limitations: ['Only the sections present were considered.'],
      improvementHints: ['Capture the competitive landscape section.'],
      requiredSectionTypes: ['MARKET_LANDSCAPE'],
      denominator: 'the market landscape sections it names',
      thresholds: [{ label: 'minSectionConfidenceScore', value: 60 }],
    },
    {
      capabilityName: 'Authority Building',
      declaration: 'Another invented declaration.',
      state: 'not-assessed' as const,
      notAssessedBecause:
        'This capability publishes no readiness assessment and declares no required BIF sections. ' +
        'Nothing has judged whether the captured context carries it, so this is not "not ready".',
      reasons: [],
      limitations: [],
      improvementHints: [],
      thresholds: [],
    },
  ],
  notAssessed: [
    {
      label: 'What the capabilities produced',
      state: 'not-assessed' as const,
      detail: 'Nothing has run at all, so there is nothing here to report.',
    },
  ],
};

function renderPanel(outcome: CapabilityReadinessOutcomeLike) {
  const assess = vi.fn(
    async (_clientId: string, _changedBy: string): Promise<CapabilityReadinessOutcomeLike> =>
      outcome,
  );
  render(<IntelligencePanel clientId="fictional-co" assess={assess} />);
  return assess;
}

/** Type a principal and press. The only path to an assessment. */
function press() {
  fireEvent.change(screen.getByLabelText('Recorded by'), {
    target: { value: 'operator:fictional' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Assess readiness' }));
}

const assessed: CapabilityReadinessOutcomeLike = {
  kind: 'assessed',
  view,
  organizationId: 'org',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('IntelligencePanel', () => {
  it('assesses nothing until the operator presses', async () => {
    // 🚫 THE ONE THAT MATTERS. A recompute-on-open is class 3 under ADR-0057 D4
    // even though its effect is entirely internal.
    const assess = renderPanel(assessed);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Assess readiness' })).toBeTruthy();
    });
    expect(assess).not.toHaveBeenCalled();
  });

  it('refuses to run without a principal, and never invents one', () => {
    const assess = renderPanel(assessed);
    const button = screen.getByRole('button', { name: 'Assess readiness' }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(assess).not.toHaveBeenCalled();
  });

  it('offers no way to run a capability', async () => {
    // 🚫 THE REFUSAL THIS SCREEN IS ABOUT. Running a capability against a real
    // business is class 3 — refused, not postponed. A readiness surface that
    // grew a "run" button would be one press from execution.
    renderPanel(assessed);

    press();

    await waitFor(() => expect(screen.getByText('Market Discovery')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /^run\b|execute|generate|publish/i })).toBeNull();
  });

  it('renders a non-adopter as not-assessed and never as "not ready"', async () => {
    // 🚫 The single most important distinction on the screen. A capability that
    // publishes no assessment has never judged this business.
    renderPanel(assessed);

    press();

    await waitFor(() => expect(screen.getByText('Authority Building')).toBeTruthy());
    expect(screen.getByText(/is not "not ready"/i)).toBeTruthy();
    expect(screen.queryByText(/not ready$/i)).toBeNull();
  });

  it('shows each row its own denominator beside its state', async () => {
    renderPanel(assessed);

    press();

    await waitFor(() =>
      expect(
        screen.getByText(/Judged against: the market landscape sections it names/),
      ).toBeTruthy(),
    );
  });

  it('puts the incommensurability on the surface, not in a footnote', async () => {
    renderPanel(assessed);

    press();

    await waitFor(() => expect(screen.getByText('These states are not comparable')).toBeTruthy());
    expect(screen.getByText(/cannot be added, averaged or ranked/)).toBeTruthy();
  });

  it('reports the produced half as not looked at, never as zero output', async () => {
    renderPanel(assessed);

    press();

    await waitFor(() => expect(screen.getByText('What the capabilities produced')).toBeTruthy());
    expect(screen.getByText(/nothing here to report/i)).toBeTruthy();
  });

  it('says nothing has been assessed, rather than showing an empty result', () => {
    renderPanel(assessed);
    expect(screen.getByText(/nothing has been assessed/i)).toBeTruthy();
  });

  it('explains a missing answer file rather than assessing an empty context', async () => {
    renderPanel({ kind: 'no-answer-file' });

    press();

    await waitFor(() => expect(screen.getByText('Discovery has not been submitted')).toBeTruthy());
    expect(screen.getByText(/nothing has been asked/i)).toBeTruthy();
  });

  it('surfaces a refusal as a refusal', async () => {
    renderPanel({ kind: 'refused', reason: 'The answer file could not be parsed.' });

    press();

    await waitFor(() => expect(screen.getByText('Refused')).toBeTruthy());
    expect(screen.getByText('The answer file could not be parsed.')).toBeTruthy();
  });

  it('names the missing variable when no workspace is configured', async () => {
    renderPanel({ kind: 'not-configured', variable: 'AGE_DISCOVERY_WORKSPACE' });

    press();

    await waitFor(() => expect(screen.getByText('AGE_DISCOVERY_WORKSPACE')).toBeTruthy());
  });
});
