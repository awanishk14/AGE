import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoredSnapshotPanel, type StoredSnapshotOutcomeLike } from './stored-snapshot-panel';
import type { StoredSnapshotView } from '@age/studio-shell';

/**
 * ADR-0064 on screen.
 *
 * 🚫 Every value here is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */
const VIEW: StoredSnapshotView = {
  provenance: 'The stored capture — an immutable row, written once and never edited',
  snapshotId: 'snapshot-fictional',
  bifId: 'bif-fictional',
  capturedAt: '2026-01-02T00:00:00.000Z',
  snapshotVersion: '1.0.0',
  contextVersion: '1.0.0',
  bifStatus: 'Draft',
  bifConfidenceScore: 12,
  bifCompletenessScore: 17,
  notStored: [
    {
      label: 'discoveryConfidenceScore',
      state: 'not-stored',
      detail: 'Discovery confidence is not kept in a snapshot. It is absent, not zero.',
    },
  ],
  presentSectionCount: 1,
  canonicalSectionCount: 12,
  sections: [{ name: 'Business Identity', type: 'business-identity' }],
  omittedSectionCount: 1,
  omittedSections: [{ name: 'Financial Position', type: 'financial-position' }],
  singularity:
    'This is the latest snapshot stored in this scope. Reading across snapshots is not ' +
    'authorized, so there is no history here.',
};

function typeBifId(value: string): void {
  fireEvent.change(screen.getByLabelText(/bif id/i), { target: { value } });
}

function found(): StoredSnapshotOutcomeLike {
  return { kind: 'found', view: VIEW, organizationId: 'org-fictional' };
}

describe('StoredSnapshotPanel', () => {
  it('reads nothing until the operator presses', async () => {
    const read = vi.fn(async () => found());
    render(<StoredSnapshotPanel clientId="client-fictional" read={read} />);

    // ⚠️ Opening the screen must not open a database connection.
    expect(read).not.toHaveBeenCalled();
    expect(screen.getByText(/nothing has been looked up/i)).toBeDefined();
  });

  it('refuses to read until a BIF id is typed, and never derives one', async () => {
    const read = vi.fn(async () => found());
    render(<StoredSnapshotPanel clientId="client-fictional" read={read} />);

    const button = screen.getByRole('button', { name: /read stored capture/i });
    expect(button.hasAttribute('disabled')).toBe(true);

    typeBifId('bif-fictional');
    expect(button.hasAttribute('disabled')).toBe(false);

    fireEvent.click(button);
    await waitFor(() => expect(read).toHaveBeenCalledWith('client-fictional', 'bif-fictional'));
  });

  it('states that the two answers are different questions, before the read', () => {
    render(<StoredSnapshotPanel clientId="client-fictional" read={async () => found()} />);

    // 🛑 D3. The notice is on screen from the start, not revealed with a result.
    expect(screen.getByText(/two different questions/i)).toBeDefined();
    expect(screen.getByText(/does not decide/i)).toBeDefined();
    expect(screen.getByText(/editable at any time/i)).toBeDefined();
  });

  it('shows the captured instant verbatim and states its own singularity', async () => {
    render(<StoredSnapshotPanel clientId="client-fictional" read={async () => found()} />);

    typeBifId('bif-fictional');
    fireEvent.click(screen.getByRole('button', { name: /read stored capture/i }));

    // 🚫 Never "2 days ago".
    expect(await screen.findByText('2026-01-02T00:00:00.000Z')).toBeDefined();
    // ⚠️ D4 — the singularity is stated ON the result, not inferred from an
    // empty list. (The BIF-id hint says the same thing above; this asserts the
    // sentence that travels WITH the row.)
    expect(screen.getByText(/there is no history here/i)).toBeDefined();
  });

  it('shows an absent score as not stored, never as zero', async () => {
    render(<StoredSnapshotPanel clientId="client-fictional" read={async () => found()} />);

    typeBifId('bif-fictional');
    fireEvent.click(screen.getByRole('button', { name: /read stored capture/i }));

    expect((await screen.findAllByText(/not stored/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/absent, not zero/i)).toBeDefined();
  });

  it('names a miss as a statement about the query', async () => {
    const reason =
      'No snapshot is stored under BIF id "bif-nothing". That is a statement about this query ' +
      'and not about the business.';

    render(
      <StoredSnapshotPanel
        clientId="client-fictional"
        read={async () => ({ kind: 'no-snapshot', reason })}
      />,
    );

    typeBifId('bif-nothing');
    fireEvent.click(screen.getByRole('button', { name: /read stored capture/i }));

    // 🚫 Never an empty panel and never "no data".
    expect(await screen.findByText(/no stored capture under that bif id/i)).toBeDefined();
    expect(screen.getByText(/statement about this query/i)).toBeDefined();
  });

  it('offers nothing that would write, capture or list snapshots', async () => {
    render(<StoredSnapshotPanel clientId="client-fictional" read={async () => found()} />);

    typeBifId('bif-fictional');
    fireEvent.click(screen.getByRole('button', { name: /read stored capture/i }));
    await screen.findByText('snapshot-fictional');

    // 🚫 D2 and D4, asserted on the rendered surface: ONE control, and it reads.
    // 🚫 No second row to step to, no history to open, no capture to write —
    // and a panel that grew one would fail here rather than ship.
    const labels = screen.getAllByRole('button').map((button) => button.textContent ?? '');

    expect(labels).toEqual(['Read stored capture']);
    for (const forbidden of ['save', 'write', 'history', 'previous', 'next', 'compare', 'run']) {
      expect(labels.some((label) => label.toLowerCase().includes(forbidden))).toBe(false);
    }
  });
});
