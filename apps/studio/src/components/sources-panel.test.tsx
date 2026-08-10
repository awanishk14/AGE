import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SourcesPanel,
  type AcceptanceOutcomeLike,
  type DocumentLike,
  type SourceReadOutcomeLike,
} from './sources-panel';

/**
 * ⚠️ Fictional throughout (ADR-0053 D3, ADR-0065 D1) — a real client's name or
 * path must never reach a committed file, not even in a fixture.
 */
const FIXTURE_DOCUMENT: DocumentLike = {
  sourceId: 'src-fictional-brief',
  label: 'Fictional Kite Repairs brief',
  kind: 'plain-text',
  locator: 'E:/fictional-operator-files/brief.txt',
  text: 'We repair kites.',
};

const QUESTIONS = [
  { id: 'q-offering', prompt: 'What does the business offer?', kind: 'text' },
] as const;

const READ_OUTCOME: SourceReadOutcomeLike = {
  kind: 'read',
  document: FIXTURE_DOCUMENT,
  outcome: {
    kind: 'passages-proposed',
    sourceId: 'src-fictional-brief',
    passages: [
      {
        passageId: 'p-1',
        locator: 'Fictional Kite Repairs brief (line 1)',
        text: 'We repair kites.',
      },
    ],
  },
  notice: 'AGE read the document and is showing its own sentences, verbatim.',
};

const RECORDED: AcceptanceOutcomeLike = {
  kind: 'recorded',
  answer: {
    questionId: 'q-offering',
    value: 'We repair kites.',
    provenance: {
      kind: 'confirmed-from-source',
      sourceId: 'src-fictional-brief',
      locator: 'Fictional Kite Repairs brief (line 1)',
      confirmedBy: 'operator:fictional',
    },
  },
  storage: 'not-stored',
};

const read = vi.fn(async (): Promise<SourceReadOutcomeLike> => READ_OUTCOME);
const record = vi.fn(async (): Promise<AcceptanceOutcomeLike> => RECORDED);

function renderPanel() {
  return render(
    <SourcesPanel
      questions={QUESTIONS}
      storageNotice="AGE has not stored it."
      read={read}
      record={record}
    />,
  );
}

function nameTheDocument() {
  fireEvent.change(screen.getByLabelText(/Absolute path/), {
    target: { value: 'E:/fictional-operator-files/brief.txt' },
  });
  fireEvent.change(screen.getByLabelText(/Source identifier/), {
    target: { value: 'src-fictional-brief' },
  });
  fireEvent.change(screen.getByLabelText(/How you refer to this document/), {
    target: { value: 'Fictional Kite Repairs brief' },
  });
}

describe('SourcesPanel', () => {
  beforeEach(() => {
    read.mockClear();
    record.mockClear();
  });

  it('reads nothing on mount', () => {
    // 🛑 Opening a screen must never be the act of opening a real client's file.
    renderPanel();
    expect(read).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('refuses to read until the operator has named the document, its id and its label', () => {
    renderPanel();
    const button = screen.getByRole('button', { name: /Read this document/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    nameTheDocument();
    expect(
      (screen.getByRole('button', { name: /Read this document/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('shows the document own words and does not say which question they answer', async () => {
    renderPanel();
    nameTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Read this document/ }));

    await waitFor(() => expect(screen.getByText('We repair kites.')).toBeDefined());
    expect(
      screen.getByText(/AGE did not decide which of them answers which question/),
    ).toBeDefined();
  });

  it('will not record until a named human has said who confirmed it', async () => {
    // ⚠️ No default acceptor, ever (ADR-0053 D4).
    renderPanel();
    nameTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Read this document/ }));
    await waitFor(() => expect(screen.getByText('We repair kites.')).toBeDefined());

    fireEvent.change(screen.getByLabelText(/Answers/), { target: { value: 'q-offering' } });
    const button = screen.getByRole('button', { name: /Record this passage/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Confirmed by/), {
      target: { value: 'operator:fictional' },
    });
    expect(
      (screen.getByRole('button', { name: /Record this passage/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('says the acceptance was not stored, and never that it was saved', async () => {
    renderPanel();
    nameTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Read this document/ }));
    await waitFor(() => expect(screen.getByText('We repair kites.')).toBeDefined());

    fireEvent.change(screen.getByLabelText(/Confirmed by/), {
      target: { value: 'operator:fictional' },
    });
    fireEvent.change(screen.getByLabelText(/Answers/), { target: { value: 'q-offering' } });
    fireEvent.click(screen.getByRole('button', { name: /Record this passage/ }));

    await waitFor(() => expect(screen.getByText(/Not stored\./)).toBeDefined());
    expect(screen.getByText(/AGE has not stored it\./)).toBeDefined();
    // 🚫 The one sentence that is permitted about provenance and scoring.
    expect(screen.getByText(/Provenance alone never changes a score/)).toBeDefined();
    expect(document.body.textContent).not.toMatch(/saved/i);
  });

  it('shows the full provenance of a recorded answer, and no confidence number', async () => {
    renderPanel();
    nameTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Read this document/ }));
    await waitFor(() => expect(screen.getByText('We repair kites.')).toBeDefined());
    fireEvent.change(screen.getByLabelText(/Confirmed by/), {
      target: { value: 'operator:fictional' },
    });
    fireEvent.change(screen.getByLabelText(/Answers/), { target: { value: 'q-offering' } });
    fireEvent.click(screen.getByRole('button', { name: /Record this passage/ }));

    await waitFor(() => expect(screen.getByText('confirmed-from-source')).toBeDefined());
    expect(screen.getByText('src-fictional-brief')).toBeDefined();
    expect(screen.getByText('operator:fictional')).toBeDefined();
    // 🚫 There is no confidence to show (ADR-0066 D3).
    expect(document.body.textContent).not.toMatch(/confidence/i);
  });

  it('renders a refusal as a refusal, without inventing a partial result', async () => {
    read.mockResolvedValueOnce({
      kind: 'refused',
      reason: 'That path is inside the repository, so it was not read.',
    });
    renderPanel();
    nameTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Read this document/ }));

    await waitFor(() => expect(screen.getByText(/The document was not read/)).toBeDefined());
    expect(screen.getByText(/inside the repository/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Record this passage/ })).toBeNull();
  });

  it('separates read-and-proposed-nothing from not-read, using the decided sentence', async () => {
    // ⚠️ ADR-0059 D7 — an empty extraction is a reason, never an empty success,
    // and 🚫 the sentence is not re-worded here.
    read.mockResolvedValueOnce({
      kind: 'read',
      document: FIXTURE_DOCUMENT,
      outcome: { kind: 'not-extracted', sourceId: 'src-fictional-brief', reason: 'empty-document' },
      notice: 'The file was read and contains no text at all.',
    });
    renderPanel();
    nameTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Read this document/ }));

    await waitFor(() =>
      expect(screen.getByText(/The document was read, and proposed nothing/)).toBeDefined(),
    );
    expect(screen.getByText(/contains no text at all/)).toBeDefined();
  });
});
