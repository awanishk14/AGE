'use server';

import { clientRecordDraftFromFormEntries } from '@age/studio-shell';

import { createClientRecord, type CreateClientOutcome } from './operator-environment';

/**
 * Creating a client — the operator's explicit act.
 *
 * 🚫 There is no autosave here and there must not be one. A half-typed identity
 * written to the record file would put a scope into circulation that names a
 * business the operator had not finished describing; unlike a discovery draft,
 * a partial record is read by everything downstream.
 *
 * ⚠️ Effects stay in ONE module: this file converts a form payload and calls
 * `operator-environment`.
 */
export async function createClientAction(formData: FormData): Promise<CreateClientOutcome> {
  const entries: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      entries[key] = value;
    }
  }

  return createClientRecord(clientRecordDraftFromFormEntries(entries));
}
