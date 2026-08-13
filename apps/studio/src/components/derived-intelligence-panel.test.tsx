import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DerivedIntelligenceView } from '@age/studio-shell';

import {
  DerivedIntelligencePanel,
  type DerivedIntelligenceOutcomeLike,
} from './derived-intelligence-panel';

/**
 * ADR-0069 deliverable 6c-2 on screen.
 *
 * 🛑 **WHAT THIS SUITE GUARDS** is the moment the screen turns a silence into a
 * clean bill. Every assertion below is one of the four silences, or the
 * derivation never having run, refusing to render as "AGE checked and it is
 * fine".
 *
 * 🚫 Every value here is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const CONTRIBUTOR = {
  sourceSystem: 'fictional-rank-system',
  sourceInstance: 'fictional-instance-a',
  sourceRecordId: 'fictional-record-1',
  claim: 'down · moderate',
  observedAt: '2026-07-31T00:00:00.000Z',
  window: '2026-07-01T00:00:00.000Z → 2026-07-31T00:00:00.000Z',
} as const;

const EMPTY_VIEW: DerivedIntelligenceView = {
  bifId: 'bif-fictional',
  conclusions: [],
  unconcluded: [],
  unobservedSubjects: [],
  unmodelledKinds: [],
  unrelated: [],
  derivationNotice: 'Every conclusion was produced by a named deterministic rule.',
  persistenceNotice: 'AGE does not store conclusions.',
  nothingConcludedNotice: 'AGE concluded nothing here. It is not "no issues found".',
};

const CONCLUDED_VIEW: DerivedIntelligenceView = {
  ...EMPTY_VIEW,
  nothingConcludedNotice: undefined,
  conclusions: [
    {
      subject: 'Fictional Service',
      subjectKind: 'service',
      statement: '2 independent source systems reported down for this subject.',
      rule: 'convergent-direction',
      asOf: '2026-08-02T00:00:00.000Z',
      producerCount: 2,
      contributors: [
        CONTRIBUTOR,
        { ...CONTRIBUTOR, sourceSystem: 'fictional-chat-system', sourceRecordId: 'record-2' },
      ],
      limitation: 'AGE does not know by how much, and it has not verified either report.',
    },
  ],
};

const press = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /derive intelligence/i }));
};

const typeBifId = (): void => {
  fireEvent.change(screen.getByLabelText(/BIF id/i), { target: { value: 'bif-fictional' } });
};

describe('DerivedIntelligencePanel', () => {
  it('🛑 derives nothing until the operator presses', () => {
    const read = vi.fn(async (): Promise<DerivedIntelligenceOutcomeLike> => ({
      kind: 'derived',
      view: EMPTY_VIEW,
      organizationId: 'org-fictional',
    }));
    render(<DerivedIntelligencePanel clientId="client-fictional" read={read} />);

    // ⚠️ Opening the screen must not open TWO database connections.
    expect(read).not.toHaveBeenCalled();
    expect(screen.getByText(/the rule has not been run/i)).toBeDefined();
  });

  it('🚫 cannot be pressed without a BIF id — 🚫 it is never defaulted', () => {
    const read = vi.fn(async (): Promise<DerivedIntelligenceOutcomeLike> => ({
      kind: 'no-context',
      reason: 'fictional reason',
    }));
    render(<DerivedIntelligencePanel clientId="client-fictional" read={read} />);

    expect(screen.getByRole('button', { name: /derive intelligence/i })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('🛑 renders NO CONTEXT as "the derivation did not run", 🚫 not as an empty result', async () => {
    const read = vi.fn(async (): Promise<DerivedIntelligenceOutcomeLike> => ({
      kind: 'no-context',
      reason: 'AGE holds no stored business context under that BIF id.',
    }));
    render(<DerivedIntelligencePanel clientId="client-fictional" read={read} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/the derivation did not run/i)).toBeDefined());
    expect(screen.getByText(/AGE holds no stored business context/i)).toBeDefined();
    // 🚫 The empty-result vocabulary must not appear on this state at all.
    expect(screen.queryByText(/AGE concluded nothing/i)).toBeNull();
  });

  it('🛑 renders an empty derivation WITH the sentence that denies a clean bill', async () => {
    const read = vi.fn(async (): Promise<DerivedIntelligenceOutcomeLike> => ({
      kind: 'derived',
      view: EMPTY_VIEW,
      organizationId: 'org-fictional',
    }));
    render(<DerivedIntelligencePanel clientId="client-fictional" read={read} />);
    typeBifId();
    press();

    // ⚠️ The heading and the sentence beneath it BOTH say it, deliberately.
    await waitFor(() => expect(screen.getAllByText(/AGE concluded nothing/i)).toHaveLength(2));
    expect(screen.getByText(/not "no issues found"/i)).toBeDefined();
  });

  it('🛑 shows every conclusion WITH its contributors, its rule and its limitation', async () => {
    const read = vi.fn(async (): Promise<DerivedIntelligenceOutcomeLike> => ({
      kind: 'derived',
      view: CONCLUDED_VIEW,
      organizationId: 'org-fictional',
    }));
    render(<DerivedIntelligencePanel clientId="client-fictional" read={read} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/What AGE concludes/i)).toBeDefined());
    expect(screen.getByText(/2 independent source systems reported down/i)).toBeDefined();
    expect(screen.getByText(/has not verified either report/i)).toBeDefined();
    expect(screen.getByText(/convergent-direction/i)).toBeDefined();
    // 🛑 BOTH producers are named. A conclusion whose evidence is one click away
    // is a conclusion the operator will believe without checking.
    expect(screen.getByText('fictional-rank-system')).toBeDefined();
    expect(screen.getByText('fictional-chat-system')).toBeDefined();
    // 🚫 The notice denying a clean bill is absent once something WAS concluded.
    expect(screen.queryByText(/AGE concluded nothing/i)).toBeNull();
  });

  it('🛑 dates a conclusion from its evidence — 🚫 never relatively, 🚫 never "now"', async () => {
    const read = vi.fn(async (): Promise<DerivedIntelligenceOutcomeLike> => ({
      kind: 'derived',
      view: CONCLUDED_VIEW,
      organizationId: 'org-fictional',
    }));
    render(<DerivedIntelligencePanel clientId="client-fictional" read={read} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/as of 2026-08-02T00:00:00\.000Z/i)).toBeDefined());
    for (const relative of ['ago', 'today', 'yesterday', 'recently']) {
      expect(screen.queryByText(new RegExp(relative, 'i'))).toBeNull();
    }
  });

  it('🛑 keeps the four silences apart, each with its own words', async () => {
    const read = vi.fn(async (): Promise<DerivedIntelligenceOutcomeLike> => ({
      kind: 'derived',
      view: {
        ...EMPTY_VIEW,
        unconcluded: [
          {
            subject: 'Fictional Service',
            subjectKind: 'service',
            reason: 'single-producer',
            explanation: 'One source restated is not a conclusion.',
            contributors: [CONTRIBUTOR],
          },
        ],
        unobservedSubjects: [
          {
            subject: 'Fictional Other Service',
            subjectKind: 'service',
            explanation: 'No source system has relayed an observation about this subject.',
          },
        ],
        unmodelledKinds: [
          { subjectKind: 'geography', explanation: 'AGE has not looked at this.' },
          { subjectKind: 'audience', explanation: 'That is what the business said.' },
        ],
        unrelated: [
          {
            sourceSystem: 'fictional-rank-system',
            sourceRecordId: 'fictional-record-9',
            claim: 'down · minor',
            observedAt: '2026-07-31T00:00:00.000Z',
            explanation: 'The gap is in what AGE models, not in the observation.',
          },
        ],
      },
      organizationId: 'org-fictional',
    }));
    render(<DerivedIntelligencePanel clientId="client-fictional" read={read} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/What AGE will not conclude/i)).toBeDefined());
    expect(screen.getByText(/single-producer/i)).toBeDefined();
    expect(screen.getByText(/One source restated is not a conclusion/i)).toBeDefined();
    expect(screen.getByText(/Subjects nobody has reported on/i)).toBeDefined();
    expect(screen.getByText(/has relayed an observation about this subject/i)).toBeDefined();
    // 🛑 The two unmodelled reasons stay DIFFERENT sentences.
    expect(screen.getByText(/AGE has not looked at this/i)).toBeDefined();
    expect(screen.getByText(/That is what the business said/i)).toBeDefined();
    // 🛑 Carried, never dropped.
    expect(screen.getByText(/could not relate/i)).toBeDefined();
    expect(screen.getByText(/fictional-record-9/i)).toBeDefined();

    // 🚫 NOT ONE of the four may render as a reassurance. ⚠️ "no issues" is not
    // in this list because the view's own sentence DENIES it in those words —
    // banning the string would ban the denial.
    for (const forbidden of [/all clear/i, /healthy/i, /looks good/i, /nothing to report/i]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it('renders a refusal as a result, 🚫 never as a blank panel', async () => {
    const read = vi.fn(async (): Promise<DerivedIntelligenceOutcomeLike> => ({
      kind: 'refused',
      reason: 'That business is not in the client record file.',
    }));
    render(<DerivedIntelligencePanel clientId="client-fictional" read={read} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/Refused/i)).toBeDefined());
    expect(screen.getByText(/not in the client record file/i)).toBeDefined();
  });

  it('names a failed request as one, 🚫 and claims nothing was derived', async () => {
    const read = vi.fn(async (): Promise<DerivedIntelligenceOutcomeLike> => {
      throw new Error('boom');
    });
    render(<DerivedIntelligencePanel clientId="client-fictional" read={read} />);
    typeBifId();
    press();

    await waitFor(() => expect(screen.getByText(/Nothing was derived/i)).toBeDefined());
  });
});
