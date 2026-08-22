import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateClientForm, type CreateClientResult } from './create-client-form';

const create = vi.fn(async (_formData: FormData): Promise<CreateClientResult> => ({
  kind: 'created',
  clientId: 'fictional-co',
  firstRecord: false,
}));

const ORGANIZATION = { id: 'org-1', displayName: 'Fictional Agency' } as const;

function renderForm() {
  return render(<CreateClientForm create={create} organization={ORGANIZATION} />);
}

function fill() {
  fireEvent.change(screen.getByLabelText(/Display name/), { target: { value: 'Fictional Co' } });
}

describe('CreateClientForm', () => {
  beforeEach(() => {
    create.mockClear();
  });

  it('asks for what the operator knows, and only that', () => {
    renderForm();
    expect(screen.getByLabelText(/Display name/)).toBeDefined();
    expect(screen.getByLabelText(/External references/)).toBeDefined();
  });

  // 🛑 ADR-0090 D1, D2 — THE OPERATOR TYPES NO IDENTIFIERS AT ALL.
  it('🚫 does not ask for a client id or an organization id', () => {
    renderForm();
    expect(screen.queryByLabelText(/Client id/)).toBeNull();
    expect(screen.queryByLabelText(/Organization id/)).toBeNull();
  });

  it('states the organization it is writing into, as text rather than a control', () => {
    // ⚠️ 🚫 NOT a disabled input and 🚫 NOT a hidden field: one looks like a
    // field the operator failed to fill in, the other is a value a browser can
    // edit and send back — which is exactly what the server stopped reading.
    const { container } = renderForm();
    expect(screen.getByText(/Fictional Agency/)).toBeDefined();
    expect(container.querySelector('input[name="organizationId"]')).toBeNull();
    expect(container.querySelector('input[name="clientId"]')).toBeNull();
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

    // 🛑 THE SUBMISSION CARRIES NO IDENTIFIERS. If either ever reappears here,
    // the server has something to read again — and reading it is the defect.
    const formData = create.mock.calls[0]?.[0] as unknown as FormData;
    expect(formData.get('displayName')).toBe('Fictional Co');
    expect(formData.get('clientId')).toBeNull();
    expect(formData.get('organizationId')).toBeNull();
  });

  it('shows a refusal against the field that caused it, and keeps the form', async () => {
    create.mockResolvedValueOnce({
      kind: 'refused',
      reason: 'A display name is required.',
      field: 'displayName',
    });
    renderForm();
    fill();

    fireEvent.click(screen.getByRole('button', { name: 'Create client' }));

    await waitFor(() => expect(screen.getByText('A display name is required.')).toBeDefined());
    // The typing survives the refusal.
    expect((screen.getByLabelText(/Display name/) as HTMLInputElement).value).toBe('Fictional Co');
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
