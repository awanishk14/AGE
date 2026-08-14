import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClientContextProjectionView } from '@age/studio-shell';

import {
  ClientContextProjectionPanel,
  type ClientContextProjectionOutcomeLike,
} from './client-context-projection-panel';

/**
 * ADR-0069 deliverable 7 on screen.
 *
 * 🛑 **WHAT THIS SUITE GUARDS** is the moment the screen lets an operator
 * believe more than is true: that a peer is already being served, that AGE
 * models nothing about a business it simply holds no context for, or that a
 * subject kind AGE was never told about is a kind the business does not have.
 *
 * 🚫 Every value here is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

/**
 * ⚠️ The console's own sentence, as ADR-0071 D1 left it: the operator carries
 * the answer. 🚫 It is not "coming soon" — nobody is building a peer credential.
 */
const HOW_IT_REACHES_A_PEER =
  'No peer product can ask AGE for this, and in V1 none is meant to: the operator is the ' +
  'transport. You carry this answer to the peer yourself, unchanged. That is a V1 transport ' +
  'constraint and not a permanent one. Nothing has been sent from this screen, and no peer ' +
  'product contains AGE code — so this is not evidence that any peer has received it, asked for ' +
  'it, or is being served.';

const VIEW: ClientContextProjectionView = {
  bifId: 'bif-fictional',
  asOf: '2026-08-02T00:00:00.000Z',
  subjectKinds: [
    {
      subjectKind: 'service',
      state: 'modelled',
      labels: ['Fictional Kite Repair'],
      unreadableEntryCount: 1,
      because: 'AGE models 1 subject(s) of this kind, as the business stated them.',
    },
    {
      subjectKind: 'geography',
      state: 'never-captured',
      labels: [],
      unreadableEntryCount: 0,
      because: 'AGE was never told about this. It has nothing to look at.',
    },
    {
      subjectKind: 'audience',
      state: 'captured-nothing-recorded',
      labels: [],
      unreadableEntryCount: 0,
      because: 'That is what was captured, not a statement that the business has none.',
    },
  ],
  notCaptured: ['kpis'],
  notices: ['This is what the business itself stated.', 'No score is included.'],
  howThisReachesAPeerNotice: HOW_IT_REACHES_A_PEER,
};

const press = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /show the peer/i }));
};

const typeBifId = (): void => {
  fireEvent.change(screen.getByLabelText(/BIF id/i), { target: { value: 'bif-fictional' } });
};

const projects = (view: ClientContextProjectionView = VIEW) =>
  vi.fn(async (): Promise<ClientContextProjectionOutcomeLike> => ({
    kind: 'projected',
    view,
    organizationId: 'org-fictional',
  }));

describe('ClientContextProjectionPanel', () => {
  it('🛑 projects nothing until the operator presses', () => {
    const read = projects();
    render(<ClientContextProjectionPanel clientId="client-fictional" read={read} />);

    // ⚠️ Opening the screen must not open a database connection.
    expect(read).not.toHaveBeenCalled();
    expect(screen.getByText(/the projection has not been run/i)).toBeDefined();
  });

  it('🚫 cannot be pressed without a BIF id — 🚫 it is never defaulted', () => {
    render(<ClientContextProjectionPanel clientId="client-fictional" read={projects()} />);

    expect(screen.getByRole('button', { name: /show the peer/i })).toHaveProperty('disabled', true);
  });

  it('🛑 states that the OPERATOR is the transport, ABOVE the answer', async () => {
    render(<ClientContextProjectionPanel clientId="client-fictional" read={projects()} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(HOW_IT_REACHES_A_PEER)).toBeDefined());
    // 🛑 It precedes the subject list in the document, not merely appears in it —
    // an operator who read the subjects first has already drawn the conclusion.
    const notice = screen.getByText(HOW_IT_REACHES_A_PEER);
    const subjects = screen.getByText(/Subjects a peer may name/i);
    expect(
      notice.compareDocumentPosition(subjects) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('🛑 renders NO CONTEXT as its own state, 🚫 not as a projection with no subjects', async () => {
    const read = vi.fn(async (): Promise<ClientContextProjectionOutcomeLike> => ({
      kind: 'no-context',
      reason: 'AGE holds no stored business context under that BIF id.',
    }));
    render(<ClientContextProjectionPanel clientId="client-fictional" read={read} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/there is nothing to project/i)).toBeDefined());
    expect(screen.getByText(/AGE holds no stored business context/i)).toBeDefined();
    // 🚫 The projected vocabulary must not appear on this state at all.
    expect(screen.queryByText(/Subjects a peer may name/i)).toBeNull();
    expect(screen.queryByText(HOW_IT_REACHES_A_PEER)).toBeNull();
  });

  it('🛑 shows every kind — 🚫 hides none for being empty, and keeps the silences apart', async () => {
    render(<ClientContextProjectionPanel clientId="client-fictional" read={projects()} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/Subjects a peer may name/i)).toBeDefined());
    let checked = 0;
    for (const kind of VIEW.subjectKinds) {
      expect(screen.getByText(kind.subjectKind), kind.subjectKind).toBeDefined();
      // 🛑 The state is on the screen, and 🛑 the reason is the projection's own
      // sentence — 🚫 never a console re-wording of it.
      expect(screen.getByText(kind.state), kind.subjectKind).toBeDefined();
      expect(screen.getByText(kind.because), kind.subjectKind).toBeDefined();
      checked += 1;
    }
    // ⚠️ Counted after the loop: a scan that examined nothing must not report
    // compliance.
    expect(checked).toBe(VIEW.subjectKinds.length);

    // 🚫 Neither silent state may be rendered as the business having none.
    expect(screen.queryByText(/has none of these/i)).toBeNull();
  });

  it('🛑 counts what AGE could not name, and 🚫 never drops it silently', async () => {
    render(<ClientContextProjectionPanel clientId="client-fictional" read={projects()} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/could not read a label from/i)).toBeDefined());
  });

  it('🚫 carries no score, and 🚫 dates the answer from the capture', async () => {
    render(<ClientContextProjectionPanel clientId="client-fictional" read={projects()} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/as of 2026-08-02T00:00:00\.000Z/i)).toBeDefined());
    // 🚫 A relative time would be a claim about now that the stored row cannot
    // support.
    for (const relative of ['ago', 'today', 'yesterday', 'recently']) {
      expect(screen.queryByText(new RegExp(relative, 'i')), relative).toBeNull();
    }
    for (const forbidden of [/completeness/i, /confidence/i, /score of/i]) {
      expect(screen.queryByText(forbidden), String(forbidden)).toBeNull();
    }
  });

  it('🛑 shows what AGE holds nothing for, as a limitation', async () => {
    render(<ClientContextProjectionPanel clientId="client-fictional" read={projects()} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/Sections AGE holds nothing for/i)).toBeDefined());
    expect(screen.getByText('kpis')).toBeDefined();
  });

  it('🛑 gives the operator the exact bytes to carry (ADR-0071 D1)', async () => {
    render(<ClientContextProjectionPanel clientId="client-fictional" read={projects()} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/Carry this to the peer product/i)).toBeDefined());

    // 🛑 The document is SHOWN, not merely offered — an operator who cannot read
    // what they are about to hand over is auditing a button, not an answer.
    const carried = screen.getByTestId('client-context-handover-document').textContent ?? '';
    expect(carried).toContain('bif-fictional');
    expect(carried).toContain('never-captured');
    expect(carried).toContain('captured-nothing-recorded');
    // 🚫 The console's own sentence never travels to a peer.
    expect(carried).not.toContain('the operator is the transport');
    expect(carried).not.toContain('howThisReachesAPeerNotice');
  });

  it('🚫 the control COPIES — 🚫 it never says sent, delivered or received', async () => {
    render(<ClientContextProjectionPanel clientId="client-fictional" read={projects()} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/Carry this to the peer product/i)).toBeDefined());

    // ADR-0071 D4: producing a document is 🚫 not evidence any peer received it.
    expect(screen.getByRole('button', { name: /copy the document/i })).toBeDefined();

    // 🛑 Scoped to the CONTROLS, on purpose. The prose may — and does — tell the
    // operator that *they* deliver it; what must never exist is a control whose
    // label implies AGE transmits. ⚠️ Counted, so a page that rendered no button
    // cannot pass this by finding nothing.
    let examined = 0;
    for (const control of screen.getAllByRole('button')) {
      const label = control.textContent ?? '';
      for (const forbidden of ['send', 'deliver', 'sync', 'push', 'transmit', 'connect']) {
        expect(label.toLowerCase(), forbidden).not.toContain(forbidden);
      }
      examined += 1;
    }
    expect(examined).toBeGreaterThan(0);

    // 🚫 And no claim, anywhere, that a peer is on the other end of this.
    for (const forbidden of [/peer received/i, /sent to the peer/i, /connected to/i]) {
      expect(screen.queryByText(forbidden), String(forbidden)).toBeNull();
    }
  });

  it('🛑 renders a refusal as a result, never as a crash', async () => {
    const read = vi.fn(async (): Promise<ClientContextProjectionOutcomeLike> => {
      throw new Error('fictional transport failure');
    });
    render(<ClientContextProjectionPanel clientId="client-fictional" read={read} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/refused/i)).toBeDefined());
    expect(screen.getByText(/Nothing was projected/i)).toBeDefined();
    // 🚫 The failure's own words never reach the screen — a driver message can
    // carry a connection string.
    expect(screen.queryByText(/fictional transport failure/i)).toBeNull();
  });
});
