import { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from '@age/business-discovery-contracts';
import { emptyDraft, isListQuestion, applyDraftAnswer } from '@age/studio-shell';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DiscoveryForm } from './discovery-form';

const questionnaire = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE;
const questions = questionnaire.sections.flatMap((section) => section.questions);

type SaveResult = { kind: string; reason?: string };
type SubmitResult = { kind: string; reason?: string; fileName?: string; questionId?: string };

const save = vi.fn(async (): Promise<SaveResult> => ({ kind: 'saved' }));
const submit = vi.fn(async (): Promise<SubmitResult> => ({
  kind: 'written',
  fileName: 'acme-1.discovery-answers.json',
}));

function renderForm(overrides: Partial<Parameters<typeof DiscoveryForm>[0]> = {}) {
  return render(
    <DiscoveryForm
      clientId="acme-1"
      questionnaire={questionnaire}
      initialDraft={emptyDraft(questionnaire)}
      everSaved={false}
      save={save}
      submit={submit}
      {...overrides}
    />,
  );
}

/** Every required question answered, so Submit becomes reachable. */
function completeDraft() {
  return questions
    .filter((question) => question.required)
    .reduce(
      (draft, question) =>
        applyDraftAnswer(draft, question.id, isListQuestion(question) ? ['x'] : 'x'),
      emptyDraft(questionnaire),
    );
}

describe('DiscoveryForm', () => {
  beforeEach(() => {
    save.mockClear();
    submit.mockClear();
    vi.useRealTimers();
  });

  it('renders every question in the questionnaire', () => {
    renderForm();
    expect(questions.length).toBeGreaterThan(10);
    for (const question of questions) {
      expect(screen.getByLabelText(new RegExp(escapeRegExp(question.prompt)))).toBeDefined();
    }
  });

  it('renders every section heading', () => {
    renderForm();
    for (const section of questionnaire.sections) {
      expect(screen.getByRole('heading', { name: section.name })).toBeDefined();
    }
  });

  it('says nothing has been saved yet, rather than showing a saved state', () => {
    renderForm();
    expect(screen.getByText('Nothing saved yet')).toBeDefined();
  });

  it('reports a count of fields and says it is NOT a score', () => {
    // 🚫 `discoveryCompletenessScore` is a different number with a different
    // meaning. Presenting this as completeness would be a fabricated score.
    renderForm();
    expect(screen.getByText(/It is not a discovery score/)).toBeDefined();
    expect(
      screen.getByText(new RegExp(`0 of ${questions.length} questions answered`)),
    ).toBeDefined();
  });

  describe('autosave', () => {
    it('saves after typing settles, without being asked', async () => {
      vi.useFakeTimers();
      renderForm();

      fireEvent.change(screen.getByLabelText(/What is the business name/), {
        target: { value: 'Fictional Business' },
      });

      expect(save).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(save).toHaveBeenCalledTimes(1);

      const [clientId, formData] = save.mock.calls[0] as unknown as [string, FormData];
      expect(clientId).toBe('acme-1');
      expect(formData.get('bi-name')).toBe('Fictional Business');
    });

    it('shows unsaved changes between the keystroke and the save', () => {
      vi.useFakeTimers();
      renderForm();

      fireEvent.change(screen.getByLabelText(/What is the business name/), {
        target: { value: 'Fictional' },
      });

      expect(screen.getByText('Unsaved changes')).toBeDefined();
    });

    it('says NOT SAVED when the save was refused, and keeps the typing on screen', async () => {
      // 🚫 A failed save must never report success. The operator would close the
      // tab believing their work was preserved.
      save.mockResolvedValueOnce({ kind: 'refused', reason: 'No workspace is configured.' });
      vi.useFakeTimers();
      renderForm();

      fireEvent.change(screen.getByLabelText(/What is the business name/), {
        target: { value: 'Fictional' },
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(screen.getByText('Not saved')).toBeDefined();
      expect(screen.getByText('No workspace is configured.')).toBeDefined();
      expect(screen.getByText(/Do not close the tab/)).toBeDefined();
      expect(
        (screen.getByLabelText(/What is the business name/) as HTMLTextAreaElement).value,
      ).toBe('Fictional');
    });

    it('NEVER submits on its own', async () => {
      // 🚫 The rule autosave must not erode. Writing the answer file is a
      // human-initiated act; a timer doing it would be class 3.
      vi.useFakeTimers();
      renderForm({ initialDraft: completeDraft(), everSaved: true });

      fireEvent.change(screen.getByLabelText(/What is the business name/), {
        target: { value: 'Fictional' },
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      expect(save).toHaveBeenCalled();
      expect(submit).not.toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    it('is disabled until every required question is answered', () => {
      renderForm();
      const button = screen.getByRole('button', { name: /Generate answer file/ });
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });

    it('says how many required questions are still unanswered', () => {
      renderForm();
      expect(screen.getByText(/required questions? (are|is) still unanswered/)).toBeDefined();
    });

    it('is enabled on a complete draft, and writes the answer file when pressed', async () => {
      renderForm({ initialDraft: completeDraft(), everSaved: true });

      const button = screen.getByRole('button', { name: /Generate answer file/ });
      expect((button as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(button);
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(screen.getByText(/Written to acme-1\.discovery-answers\.json/)).toBeDefined(),
      );
    });

    it('surfaces a refusal instead of claiming the file was written', async () => {
      submit.mockResolvedValueOnce({
        kind: 'refused',
        reason: 'The answer file could not be written to the discovery workspace.',
      });
      renderForm({ initialDraft: completeDraft(), everSaved: true });

      fireEvent.click(screen.getByRole('button', { name: /Generate answer file/ }));

      await waitFor(() =>
        expect(screen.getByText(/could not be written to the discovery workspace/)).toBeDefined(),
      );
      expect(screen.queryByText(/^Written to/)).toBeNull();
    });

    it('states that it does not generate a BIF or write to a database', () => {
      // ⚠️ ADR-0055 D7 is untouched by this slice, and the screen says so.
      renderForm();
      expect(
        screen.getByText(/does not generate a BIF, run capture or write to a database/),
      ).toBeDefined();
    });
  });

  it('tells the operator that a list is never split for them', () => {
    // ⚠️ ADR-0050 D2 — transcribe, never infer — surfaced where it matters.
    renderForm();
    expect(screen.getAllByText(/AGE never splits one answer into several/).length).toBeGreaterThan(
      0,
    );
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
