import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ContradictionsPanel, type ContradictionsOutcomeLike } from './contradictions-panel';

/**
 * ⚠️ The fixture is the SHAPE the real view produces for a first discovery run:
 * sources recorded, none readable by the detector, the outcome `not-run`.
 * 🚫 It carries no result and no count of contradictions, because the view has
 * no field that could hold one.
 */
const REPORTED: ContradictionsOutcomeLike = {
  kind: 'reported',
  organizationId: 'org-fictional',
  view: {
    namedSourceCount: 3,
    signalCarryingSourceCount: 0,
    preconditions: [
      {
        requirement: 'Evidence records carrying an extracted signal, with a polarity.',
        observed: '3 sources recorded, none carrying a signal.',
        status: 'unmet',
      },
      {
        requirement: 'At least two records sharing a signal type and an entity.',
        observed: 'Cannot be checked: there are no signal-carrying records to pair.',
        status: 'unevaluable',
      },
    ],
    outcome: 'not-run',
    outcomeBecause:
      'The detector was deliberately not run. Nothing about this business has been checked.',
    notAssessed: [
      {
        facet: 'Whether this business contradicts itself',
        because: 'The detector was not run, and no evidence records exist for it to compare.',
        state: 'not-assessed',
      },
    ],
  },
};

function renderPanel(outcome: ContradictionsOutcomeLike = REPORTED) {
  const report = vi.fn(async () => outcome);
  render(<ContradictionsPanel clientId="fictional-kites" report={report} />);
  return report;
}

function press() {
  fireEvent.change(screen.getByLabelText('Recorded by'), {
    target: { value: 'operator:tester' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Report what is missing' }));
}

describe('ContradictionsPanel', () => {
  /**
   * 🚫 A recompute-on-open is class 3 under ADR-0057 D4 even though its effect
   * is entirely internal. Made to fail by adding a mount effect.
   */
  it('reports nothing until the operator presses', () => {
    const report = renderPanel();

    expect(report).not.toHaveBeenCalled();
    expect(screen.getByText(/Nothing has been reported in this session/)).toBeDefined();
  });

  it('refuses to act without a principal, and never defaults one', () => {
    renderPanel();

    expect(
      (screen.getByRole('button', { name: 'Report what is missing' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect((screen.getByLabelText('Recorded by') as HTMLInputElement).value).toBe('');
  });

  /**
   * 🛑 THE LOAD-BEARING ASSERTION OF THE WHOLE SCREEN. There is no control that
   * runs the detector, and there must never be one.
   */
  it('offers no way to run the detector', () => {
    renderPanel();

    expect(
      screen.queryByRole('button', { name: /detect|check|scan|analy[sz]e|resolve/i }),
    ).toBeNull();
  });

  /**
   * 🚫 The sentence that must never be printed. An empty detector result shown
   * here would turn "AGE has never looked" into "AGE checked this business and
   * it is sound".
   */
  it('never prints a clean bill of health', async () => {
    renderPanel();
    press();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'The detector was not run' })).toBeDefined(),
    );

    const text = document.body.textContent ?? '';
    let checked = 0;
    for (const phrase of [
      'No contradictions',
      'no contradictions found',
      'no conflicts',
      'consistent',
      'All clear',
      'no issues',
    ]) {
      checked += 1;
      expect(text.toLowerCase(), `must not say "${phrase}"`).not.toContain(phrase.toLowerCase());
    }
    expect(checked).toBe(6);
  });

  /**
   * ⚠️ Both counts, and the first one is the operator's real work. 🚫 Showing
   * only "0 readable" would tell them they recorded nothing.
   */
  it('separates sources recorded from sources the detector could read', async () => {
    renderPanel();
    press();

    await waitFor(() => expect(screen.getByText('Sources recorded')).toBeDefined());
    expect(screen.getByText(/Of those, readable by the detector/)).toBeDefined();
  });

  /** ⚠️ "Not present" and "could not be checked" are different statements. */
  it('distinguishes a measured shortfall from one it could not check', async () => {
    renderPanel();
    press();

    await waitFor(() => expect(screen.getByText('Not present')).toBeDefined());
    expect(screen.getByText('Could not be checked')).toBeDefined();
  });

  it('states what it has not looked at, with the reason', async () => {
    renderPanel();
    press();

    await waitFor(() =>
      expect(screen.getByText('Whether this business contradicts itself')).toBeDefined(),
    );
    expect(screen.getByText(/no evidence records exist/)).toBeDefined();
  });

  it('reports a missing answer file as nothing recorded, not as nothing wrong', async () => {
    renderPanel({ kind: 'no-answer-file' });
    press();

    await waitFor(() => expect(screen.getByText('Discovery has not been submitted')).toBeDefined());
  });

  it('surfaces a refusal verbatim', async () => {
    renderPanel({ kind: 'refused', reason: 'That business is not in the client record file.' });
    press();

    await waitFor(() => expect(screen.getByText('Refused')).toBeDefined());
    expect(screen.getByText('That business is not in the client record file.')).toBeDefined();
  });

  it('names the missing variable rather than guessing a workspace', async () => {
    renderPanel({ kind: 'not-configured', variable: 'AGE_DISCOVERY_WORKSPACE' });
    press();

    await waitFor(() => expect(screen.getByText('AGE_DISCOVERY_WORKSPACE')).toBeDefined());
  });
});
