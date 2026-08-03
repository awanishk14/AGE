import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateClientForm, type CreateClientResult } from './create-client-form';

const create = vi.fn(async (_formData: FormData): Promise<CreateClientResult> => ({
  kind: 'created',
  clientId: 'fictional-co',
  firstRecord: false,
}));

function renderForm() {
  return render(<CreateClientForm create={create} />);
}

function fill() {
  fireEvent.change(screen.getByLabelText(/Client id/), { target: { value: 'fictional-co' } });
  fireEvent.change(screen.getByLabelText(/Display name/), { target: { value: 'Fictional Co' } });
  fireEvent.change(screen.getByLabelText(/Organization id/), { target: { value: 'org-1' } });
}

describe('CreateClientForm', () => {
  beforeEach(() => {
    create.mockClear();
  });

  it('asks for the four things a record carries and nothing else', () => {
    renderForm();
    expect(screen.getByLabelText(/Client id/)).toBeDefined();
    expect(screen.getByLabelText(/Display name/)).toBeDefined();
    expect(screen.getByLabelText(/Organization id/)).toBeDefined();
    expect(screen.getByLabelText(/External references/)).toBeDefined();
  });

  it('states that it creates an identity and nothing else', () => {
    // ⚠️ On the screen, not only in an ADR: no organization, no access, no
    // external contact, nothing about what the business does.
    renderForm();
    expect(
      screen.getByText(
        /does not create an organization, grant anyone access, contact any external/,
      ),
    ).toBeDefined();
  });

  it('says external references are optional and that having none is ordinary', () => {
    renderForm();
    expect(screen.getByText(/that is an ordinary business, not an incomplete one/)).toBeDefined();
  });

  it('submits what was typed, and only on the operator’s press', async () => {
    renderForm();
    fill();

    // 🚫 No autosave on this form: a half-written identity is read downstream
    // as a real scope.
    expect(create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Create client' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));

    const formData = create.mock.calls[0]?.[0] as unknown as FormData;
    expect(formData.get('clientId')).toBe('fictional-co');
    expect(formData.get('organizationId')).toBe('org-1');
  });

  it('shows a refusal against the field that caused it, and keeps the form', async () => {
    create.mockResolvedValueOnce({
      kind: 'refused',
      reason: 'That client id is already in the record file.',
      field: 'clientId',
    });
    renderForm();
    fill();

    fireEvent.click(screen.getByRole('button', { name: 'Create client' }));

    await waitFor(() =>
      expect(screen.getByText('That client id is already in the record file.')).toBeDefined(),
    );
    // The typing survives the refusal.
    expect((screen.getByLabelText(/Client id/) as HTMLInputElement).value).toBe('fictional-co');
  });

  it('shows a refusal with no field at the bottom', async () => {
    create.mockResolvedValueOnce({
      kind: 'refused',
      reason: 'The client record file could not be written.',
    });
    renderForm();
    fill();

    fireEvent.click(screen.getByRole('button', { name: 'Create client' }));
    await waitFor(() =>
      expect(screen.getByText('The client record file could not be written.')).toBeDefined(),
    );
  });

  it('explains an unconfigured record file instead of claiming success', async () => {
    create.mockResolvedValueOnce({ kind: 'not-configured', variable: 'AGE_CLIENT_RECORD_FILE' });
    renderForm();
    fill();

    fireEvent.click(screen.getByRole('button', { name: 'Create client' }));

    await waitFor(() => expect(screen.getByText(/there is nowhere to write this/)).toBeDefined());
    expect(screen.getByText('AGE_CLIENT_RECORD_FILE')).toBeDefined();
    expect(screen.queryByText('Client created')).toBeNull();
  });

  describe('after creation', () => {
    it('confirms, and says nothing is known about the business yet', async () => {
      // ⚠️ A record is an identity. Rendering it as a business AGE knows things
      // about would be the unlooked-at-absence failure in a new place.
      renderForm();
      fill();
      fireEvent.click(screen.getByRole('button', { name: 'Create client' }));

      await waitFor(() => expect(screen.getByText('Client created')).toBeDefined());
      expect(screen.getByText(/Nothing is known about this business yet/)).toBeDefined();
    });

    it('offers Discovery for the business just created', async () => {
      renderForm();
      fill();
      fireEvent.click(screen.getByRole('button', { name: 'Create client' }));

      await waitFor(() =>
        expect(screen.getByRole('link', { name: 'Start Discovery' })).toBeDefined(),
      );
      expect(screen.getByRole('link', { name: 'Start Discovery' }).getAttribute('href')).toBe(
        '/b/fictional-co/discovery',
      );
    });

    it('says when the record file itself had to be created', async () => {
      create.mockResolvedValueOnce({
        kind: 'created',
        clientId: 'fictional-co',
        firstRecord: true,
      });
      renderForm();
      fill();
      fireEvent.click(screen.getByRole('button', { name: 'Create client' }));

      await waitFor(() =>
        expect(screen.getByText(/record file did not exist yet and was created/)).toBeDefined(),
      );
    });

    it('does NOT say the file was created when it already existed', async () => {
      renderForm();
      fill();
      fireEvent.click(screen.getByRole('button', { name: 'Create client' }));

      await waitFor(() => expect(screen.getByText('Client created')).toBeDefined());
      expect(screen.queryByText(/record file did not exist yet/)).toBeNull();
    });
  });
});
