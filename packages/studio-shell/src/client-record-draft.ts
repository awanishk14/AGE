import { parseClientRecord, type ClientRecord } from '@age/client-registry';

import { assertSafeClientIdForFileName, UnsafeClientIdError } from './discovery-workspace';

/**
 * Creating a client, decided here and written by `apps/studio`.
 *
 * ⚠️ This is class 1 (Platform Administration) under ADR-0057 D4: the operator
 * types their own business's identity and presses a button. Nothing is
 * initiated by AGE and nothing leaves it.
 *
 * 🚫 It creates a RECORD, not an ADR-0009 `Client` aggregate — no lifecycle, no
 * status, no business attributes. A fact a capability would reason over belongs
 * in the BIF, where it gains provenance and confidence.
 *
 * 🚫 It does NOT create an organization. No tenant model exists (ADR-0058 D4),
 * so `organizationId` is a string the operator supplies and the Organizations
 * band stays derived from it. A screen that "created" an organization would be
 * inventing a level the system cannot enforce.
 *
 * 🚫 Nothing here touches a file. `apps/studio` holds every effect.
 */

/** What the operator typed into the Create Client form. */
export interface ClientRecordDraft {
  readonly clientId: string;
  readonly organizationId: string;
  readonly displayName: string;
  /** Raw `key = value` lines, exactly as typed. May be empty. */
  readonly externalRefsText: string;
}

export type ClientRecordDraftOutcome =
  | { readonly kind: 'valid'; readonly record: ClientRecord }
  /**
   * ⚠️ `field` lets the form point at the input that needs fixing without the
   * message having to quote what was typed.
   */
  | { readonly kind: 'refused'; readonly reason: string; readonly field?: string };

export const CLIENT_RECORD_DRAFT_FIELDS = Object.freeze([
  'clientId',
  'organizationId',
  'displayName',
  'externalRefsText',
] as const);

/** An empty form. */
export function emptyClientRecordDraft(): ClientRecordDraft {
  return Object.freeze({
    clientId: '',
    organizationId: '',
    displayName: '',
    externalRefsText: '',
  });
}

/** Read the form back into a draft. Values are passed through untrimmed. */
export function clientRecordDraftFromFormEntries(
  entries: Readonly<Record<string, string>>,
): ClientRecordDraft {
  return Object.freeze({
    clientId: entries.clientId ?? '',
    organizationId: entries.organizationId ?? '',
    displayName: entries.displayName ?? '',
    externalRefsText: entries.externalRefsText ?? '',
  });
}

/**
 * Parse the `externalRefs` lines.
 *
 * ⚠️ Refusals name a LINE NUMBER, never the line. The value on a bad line is
 * frequently an advertising account id or a peer-product handle for a real
 * business, and a refusal that echoed it would put it wherever the message goes.
 *
 * 🚫 A blank block is an empty map, not a refusal: a business that is not yet in
 * any peer product is an ordinary business, not an incomplete one.
 */
export function parseExternalRefsText(text: string):
  | { readonly kind: 'valid'; readonly refs: Readonly<Record<string, string>> }
  | {
      readonly kind: 'refused';
      readonly reason: string;
    } {
  const refs: Record<string, string> = {};
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').trim();
    if (line === '') continue;

    const separator = line.indexOf('=');
    if (separator === -1) {
      return {
        kind: 'refused',
        reason:
          `Line ${index + 1} of the external references is not a "key = value" pair. ` +
          "Each line names one peer product and that product's own identifier for this business.",
      };
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (key === '' || value === '') {
      return {
        kind: 'refused',
        reason:
          `Line ${index + 1} of the external references has an empty key or value. ` +
          'A reference with a missing side would claim a correspondence that does not exist.',
      };
    }

    if (Object.prototype.hasOwnProperty.call(refs, key)) {
      // 🚫 Refused rather than last-wins. Choosing silently which identifier a
      // system maps to is the same failure a duplicate clientId is refused for.
      return {
        kind: 'refused',
        reason:
          `Line ${index + 1} repeats a system named earlier. Two identifiers for one system ` +
          'would mean choosing silently which one AGE sends.',
      };
    }

    refs[key] = value;
  }

  return { kind: 'valid', refs: Object.freeze(refs) };
}

/**
 * Turn what the operator typed into a `ClientRecord`, or refuse.
 *
 * ⚠️ `clientId` is validated with the SAME function that guards the discovery
 * file names — `assertSafeClientIdForFileName`. That is deliberate and is not
 * over-strict: the id created here becomes a file name later, so an id accepted
 * at creation and refused at Discovery would produce a business that exists and
 * cannot be worked on.
 */
export function validateClientRecordDraft(draft: ClientRecordDraft): ClientRecordDraftOutcome {
  const clientId = draft.clientId.trim();
  const organizationId = draft.organizationId.trim();
  const displayName = draft.displayName.trim();

  if (clientId === '') {
    return { kind: 'refused', reason: 'A client id is required.', field: 'clientId' };
  }

  try {
    assertSafeClientIdForFileName(clientId);
  } catch (error) {
    if (error instanceof UnsafeClientIdError) {
      // ⚠️ The message does not echo the id — that rule belongs to the guard and
      // is not weakened by being surfaced in a form.
      return { kind: 'refused', reason: error.message, field: 'clientId' };
    }
    throw error;
  }

  if (organizationId === '') {
    return {
      kind: 'refused',
      reason:
        'An organization id is required. It is the scope every capability invocation carries, ' +
        'and AGE will not infer one.',
      field: 'organizationId',
    };
  }

  if (displayName === '') {
    return { kind: 'refused', reason: 'A display name is required.', field: 'displayName' };
  }

  const refs = parseExternalRefsText(draft.externalRefsText);
  if (refs.kind === 'refused') {
    return { kind: 'refused', reason: refs.reason, field: 'externalRefsText' };
  }

  try {
    // ⚠️ Validated through the registry's OWN schema, not a second copy of it.
    // A form that agreed with itself and disagreed with the loader would create
    // records the console could no longer read back.
    return {
      kind: 'valid',
      record: parseClientRecord({
        clientId,
        organizationId,
        displayName,
        externalRefs: refs.refs,
      }),
    };
  } catch (error) {
    return { kind: 'refused', reason: (error as Error).message };
  }
}

/**
 * Append a record to the ones already on file.
 *
 * 🚫 A duplicate `clientId` is REFUSED, never merged or replaced. The loader
 * refuses duplicates too, so writing one would produce a file that cannot be
 * read — and replacing an existing record would silently rewrite a real
 * business's identity from a form meant to create a new one.
 */
export function appendClientRecord(
  existing: readonly ClientRecord[],
  record: ClientRecord,
):
  | { readonly kind: 'appended'; readonly records: readonly ClientRecord[] }
  | {
      readonly kind: 'refused';
      readonly reason: string;
      readonly field?: string;
    } {
  if (existing.some((candidate) => candidate.clientId === record.clientId)) {
    return {
      kind: 'refused',
      reason:
        'That client id is already in the record file. Ids are not reused, and this form ' +
        'creates a business rather than editing one.',
      field: 'clientId',
    };
  }

  return { kind: 'appended', records: Object.freeze([...existing, record]) };
}

/**
 * Render the client record file.
 *
 * ⚠️ Field order is fixed and the output is stable, so re-rendering an unchanged
 * registry produces an identical file. 🚫 No timestamp, no generated id and no
 * "createdBy" — none of them is a fact the operator supplied, and a record must
 * carry nothing AGE invented.
 */
export function renderClientRecordFile(records: readonly ClientRecord[]): string {
  return `${JSON.stringify(
    {
      records: records.map((record) => ({
        clientId: record.clientId,
        organizationId: record.organizationId,
        displayName: record.displayName,
        externalRefs: record.externalRefs,
      })),
    },
    null,
    2,
  )}\n`;
}
