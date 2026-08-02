import { OperatorFilePathRefusedError } from '@age/operator-file-policy';
import { describe, expect, it } from 'vitest';

import {
  ClientRecordFileError,
  loadClientRecordFile,
  requireClientRecord,
} from '../load-client-record-file';

/**
 * ADR-0054 D3 — the real `ClientRecord` is loaded from a local file, by the
 * same rules as D2.
 *
 * 🚫 Every record in this file is obviously fictional. Real client names and
 * external account ids never enter the repository, not even in a test and not
 * redacted (ADR-0053 D3). Obvious fictionality IS the guard — these fixtures
 * are deliberately not "more realistic".
 *
 * ⚠️ The package performs no I/O: the reader is injected, so a refused path can
 * be shown to be refused BEFORE any read happens.
 */

const REPO = '/home/operator/AGE';
const OUTSIDE = '/home/operator/age-private/clients.json';

const RECORD = {
  clientId: 'client-fictional-1',
  organizationId: 'org-fictional-1',
  displayName: 'Wholly Invented Widgets (FICTIONAL)',
  externalRefs: { 'crm.example.invalid': 'acct-000-fictional' },
};

const OTHER = {
  clientId: 'client-fictional-2',
  organizationId: 'org-fictional-2',
  displayName: 'Entirely Made Up Bakery (FICTIONAL)',
  externalRefs: {},
};

const VALID = JSON.stringify({ records: [RECORD, OTHER] });

function load(text: string, path: string = OUTSIDE) {
  return loadClientRecordFile({
    path,
    repositoryRoot: REPO,
    readFileText: () => text,
  });
}

describe('loadClientRecordFile', () => {
  it('reads the operator-supplied path and returns validated records', () => {
    const seen: string[] = [];
    const records = loadClientRecordFile({
      path: OUTSIDE,
      repositoryRoot: REPO,
      readFileText: (p) => {
        seen.push(p);
        return VALID;
      },
    });

    expect(seen).toEqual([OUTSIDE]);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual(RECORD);
  });

  it('refuses an in-repository path BEFORE reading anything', () => {
    let reads = 0;
    expect(() =>
      loadClientRecordFile({
        path: `${REPO}/clients.json`,
        repositoryRoot: REPO,
        readFileText: () => {
          reads += 1;
          return VALID;
        },
      }),
    ).toThrow(OperatorFilePathRefusedError);

    // The refusal must precede the effect — otherwise a refused path has
    // already been opened.
    expect(reads).toBe(0);
  });

  it('names the client record file in the path refusal, not the answer file', () => {
    expect(() =>
      loadClientRecordFile({
        path: `${REPO}/clients.json`,
        repositoryRoot: REPO,
        readFileText: () => VALID,
      }),
    ).toThrow(/client record file/);
  });

  it('refuses a relative path rather than resolving it against cwd', () => {
    expect(() => load(VALID, 'clients.json')).toThrow(OperatorFilePathRefusedError);
  });

  it('turns a reader failure into a refusal, never an empty registry', () => {
    expect(() =>
      loadClientRecordFile({
        path: OUTSIDE,
        repositoryRoot: REPO,
        readFileText: () => {
          throw new Error('ENOENT: no such file');
        },
      }),
    ).toThrow(ClientRecordFileError);
  });

  it('refuses malformed JSON', () => {
    expect(() => load('{ not json')).toThrow(ClientRecordFileError);
  });

  /**
   * The refusal must not carry the file back. ⚠️ V8's "Unexpected token" class
   * QUOTES A WINDOW OF THE SOURCE — `Unexpected token 'W', ..."playName":Wholly
   * Inv"... is not valid JSON` — so splicing the parser's message into the
   * refusal printed part of the record onto stderr.
   *
   * ⚠️ The unquoted-value fixture below is chosen BECAUSE it produces that
   * class. The positional class ("at position 59") does not quote the source at
   * all, so a fixture that produced one would have made this guard vacuous.
   */
  const LEAKY = `{"records":[{"clientId":"client-fictional-1","displayName":Wholly Invented Widgets}]}`;

  it('the fixture really does make the parser quote the file', () => {
    // Otherwise a future Node that stopped quoting would leave the guard below
    // passing while proving nothing.
    let raw = '';
    try {
      JSON.parse(LEAKY);
    } catch (error) {
      raw = (error as Error).message;
    }
    expect(raw).toContain('Wholly');
    expect(raw).toContain('playName');
  });

  it('says only what it is allowed to say about a malformed file', () => {
    let message = '';
    try {
      load(LEAKY);
    } catch (error) {
      message = (error as Error).message;
    }

    // An EXACT match, not a set of absent substrings: it is the only assertion
    // that cannot be satisfied by a message that leaks something unlisted.
    expect(message).toBe('The client record file is not valid JSON (at an unreported position).');
  });

  it('reports the position when the parser gives one', () => {
    let message = '';
    try {
      load('{"records":[{"clientId":"client-fictional-1"} broken]}');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/^The client record file is not valid JSON \(at position \d+\)\.$/);
  });

  it('refuses a document without a records array', () => {
    expect(() => load(JSON.stringify({ clients: [RECORD] }))).toThrow(/"records" array/);
    expect(() => load(JSON.stringify([RECORD]))).toThrow(/"records" array/);
  });

  it('refuses an empty records array rather than accepting an empty registry', () => {
    // Otherwise every later lookup reports "unknown client" for the wrong
    // reason, and the operator debugs the id instead of the file.
    expect(() => load(JSON.stringify({ records: [] }))).toThrow(ClientRecordFileError);
  });

  it('refuses a malformed record, naming its position', () => {
    const text = JSON.stringify({ records: [RECORD, { clientId: 'client-fictional-2' }] });
    expect(() => load(text)).toThrow(/position 1/);
  });

  it('refuses an unrecognised property rather than ignoring it', () => {
    // `clientRecordSchema` is strict: an attribute a capability would reason
    // over belongs in the BIF, never on the record (ADR-0053 D1).
    const text = JSON.stringify({ records: [{ ...RECORD, monthlyRevenue: 1000 }] });
    expect(() => load(text)).toThrow(ClientRecordFileError);
  });

  it('refuses a duplicate clientId rather than silently choosing one', () => {
    const text = JSON.stringify({ records: [RECORD, { ...RECORD, organizationId: 'org-other' }] });
    expect(() => load(text)).toThrow(/appears more than once/);
  });

  it('does not echo the record contents back in a validation refusal', () => {
    // ⚠️ A refusal that quoted the file would carry a real client's name into
    // whatever log or terminal transcript catches it.
    let message = '';
    try {
      load(
        JSON.stringify({
          records: [{ ...RECORD, displayName: '', clientId: 'client-fictional-9' }],
        }),
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/position 0/);
    expect(message).not.toContain('Wholly Invented Widgets');
  });

  it('freezes what it returns', () => {
    const records = load(VALID);
    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
  });
});

describe('requireClientRecord', () => {
  it('returns the record for a known id', () => {
    const records = load(VALID);
    expect(requireClientRecord(records, 'client-fictional-2')).toEqual(OTHER);
  });

  it('REFUSES an unknown id instead of fabricating a record', () => {
    // ⚠️ ADR-0054 D3: a fabricated record produces a scope that names nothing,
    // and under D6 that scope reaches a database.
    const records = load(VALID);
    expect(() => requireClientRecord(records, 'client-not-present')).toThrow(ClientRecordFileError);
    expect(() => requireClientRecord(records, 'client-not-present')).toThrow(/client-not-present/);
  });

  it('does not list the other clients in the refusal', () => {
    // The requested id is already the operator's; the rest are other clients'
    // names and must not be disclosed by an error message.
    const records = load(VALID);
    let message = '';
    try {
      requireClientRecord(records, 'client-not-present');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain('client-fictional-1');
    expect(message).not.toContain('Entirely Made Up Bakery');
  });

  it('carries the offending clientId on the error', () => {
    const records = load(VALID);
    try {
      requireClientRecord(records, 'client-not-present');
      expect.unreachable('the lookup should have been refused');
    } catch (error) {
      expect((error as ClientRecordFileError).clientId).toBe('client-not-present');
    }
  });
});
