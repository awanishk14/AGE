import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StoredSourceObservation } from '@age/studio-shell';

import {
  RelayedObservationsPanel,
  type RelayedObservationsOutcomeLike,
} from './relayed-observations-panel';

/**
 * ADR-0069 deliverable 6 on screen.
 *
 * 🚫 Every value here is obviously fictional (ADR-0053 D3, ADR-0065 D1) — no
 * real business, no real peer-product instance, not even redacted.
 */
const observation = (
  overrides: Partial<StoredSourceObservation> = {},
): StoredSourceObservation => ({
  observationId: 'obs-fictional-1',
  organizationId: 'org-fictional',
  sourceSystem: 'fictional-rank-system',
  sourceInstance: 'fictional-instance-a',
  sourceRecordId: 'fictional-record-1',
  subject: { kind: 'modelled', subjectKind: 'service', label: 'Fictional Service' },
  claim: { direction: 'up', materiality: 'moderate' },
  period: {
    observedAt: '2026-05-04T00:00:00.000Z',
    windowStart: '2026-04-01T00:00:00.000Z',
    windowEnd: '2026-05-01T00:00:00.000Z',
  },
  claimKind: 'raw-observation',
  recordedAt: '2026-05-20T00:00:00.000Z',
  ...overrides,
});

const press = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /read relayed observations/i }));
};

describe('RelayedObservationsPanel', () => {
  it('reads nothing until the operator presses', () => {
    const read = vi.fn(async (): Promise<RelayedObservationsOutcomeLike> => ({
      kind: 'none-relayed',
      reason: 'fictional reason',
    }));
    render(<RelayedObservationsPanel clientId="client-fictional" read={read} />);

    // ⚠️ Opening the screen must not open a database connection.
    expect(read).not.toHaveBeenCalled();
    expect(screen.getByText(/AGE has not looked/i)).toBeDefined();
  });

  it('renders an empty relay as a named state carrying its reason', async () => {
    // 🛑 NEVER AN EMPTY LIST. Under FORCE RLS an unscoped SELECT returns zero
    // rows silently, so "nothing shown" must never be able to stand in for an
    // answer AGE has not actually got.
    const read = vi.fn(async (): Promise<RelayedObservationsOutcomeLike> => ({
      kind: 'none-relayed',
      reason: 'No source system has relayed an observation for this business.',
    }));
    render(<RelayedObservationsPanel clientId="client-fictional" read={read} />);
    press();

    await waitFor(() => expect(screen.getByText(/Nothing has been relayed/i)).toBeDefined());
    expect(screen.getByText(/No source system has relayed an observation/i)).toBeDefined();
  });

  it('names a refusal and a missing configuration separately', async () => {
    const read = vi.fn(async (): Promise<RelayedObservationsOutcomeLike> => ({
      kind: 'not-configured',
      variable: 'AGE_FICTIONAL_VARIABLE',
    }));
    render(<RelayedObservationsPanel clientId="client-fictional" read={read} />);
    press();

    await waitFor(() => expect(screen.getByText(/Nothing has been configured/i)).toBeDefined());
    expect(screen.getByText(/AGE_FICTIONAL_VARIABLE/)).toBeDefined();
    // 🚫 A missing variable is NOT "nothing has been relayed".
    expect(screen.queryByText(/Nothing has been relayed/i)).toBeNull();
  });

  it('shows both notices above the observations, and both instants', async () => {
    const read = vi.fn(async (): Promise<RelayedObservationsOutcomeLike> => ({
      kind: 'read',
      observations: [observation()],
      organizationId: 'org-fictional',
    }));
    render(<RelayedObservationsPanel clientId="client-fictional" read={read} />);
    press();

    await waitFor(() => expect(screen.getByText(/fictional-rank-system/)).toBeDefined());
    expect(screen.getByText(/Arriving is not being confirmed/i)).toBeDefined();
    expect(screen.getByText(/may have run and found nothing/i)).toBeDefined();
    expect(screen.getByText('2026-05-04T00:00:00.000Z')).toBeDefined();
    expect(screen.getByText('2026-05-20T00:00:00.000Z')).toBeDefined();
    expect(screen.getByText(/1 observation relayed to AGE/)).toBeDefined();
  });

  it('labels an unmapped subject as unmapped rather than as coverage', async () => {
    const read = vi.fn(async (): Promise<RelayedObservationsOutcomeLike> => ({
      kind: 'read',
      observations: [
        observation({ subject: { kind: 'unmapped', topicLabel: 'Fictional Unknown Topic' } }),
      ],
      organizationId: 'org-fictional',
    }));
    render(<RelayedObservationsPanel clientId="client-fictional" read={read} />);
    press();

    await waitFor(() => expect(screen.getByText('unmapped')).toBeDefined());
    expect(screen.getByText(/Fictional Unknown Topic/)).toBeDefined();
    expect(screen.getByText(/does not model this subject/i)).toBeDefined();
  });

  it('offers no way to relay an observation from this screen', async () => {
    const read = vi.fn(async (): Promise<RelayedObservationsOutcomeLike> => ({
      kind: 'read',
      observations: [observation()],
      organizationId: 'org-fictional',
    }));
    render(<RelayedObservationsPanel clientId="client-fictional" read={read} />);
    press();

    await waitFor(() => expect(screen.getByText(/fictional-rank-system/)).toBeDefined());
    // 🚫 THE RELAY IS A SEPARATE ACT ON A SEPARATE PATH (ADR-0069 D3). The
    // façade behind this screen carries no `append`, and neither does the UI.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(
      screen.queryByText(/relay an observation|add observation|record observation/i),
    ).toBeNull();
  });

  it('turns a failed request into a refusal rather than a blank screen', async () => {
    const read = vi.fn(async (): Promise<RelayedObservationsOutcomeLike> => {
      throw new Error('fictional transport failure');
    });
    render(<RelayedObservationsPanel clientId="client-fictional" read={read} />);
    press();

    await waitFor(() => expect(screen.getByText(/Refused/i)).toBeDefined());
    expect(screen.getByText(/Nothing was read/i)).toBeDefined();
  });
});
