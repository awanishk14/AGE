import { loadClientRecordFile, parseClientRecord } from '@age/client-registry';
import { describe, expect, it } from 'vitest';

import {
  appendClientRecord,
  clientRecordDraftFromFormEntries,
  emptyClientRecordDraft,
  parseExternalRefsText,
  renderClientRecordFile,
  validateClientRecordDraft,
  type ClientRecordDraft,
} from './client-record-draft';

function draft(overrides: Partial<ClientRecordDraft> = {}): ClientRecordDraft {
  return {
    clientId: 'fictional-co',
    organizationId: 'org-fictional',
    displayName: 'Fictional Co',
    externalRefsText: '',
    ...overrides,
  };
}

describe('validateClientRecordDraft', () => {
  it('accepts a complete draft', () => {
    const outcome = validateClientRecordDraft(draft());
    expect(outcome.kind).toBe('valid');
  });

  it('trims the operator’s surrounding whitespace on the identity fields', () => {
    const outcome = validateClientRecordDraft(
      draft({ clientId: '  fictional-co  ', displayName: ' Fictional Co ' }),
    );
    expect(outcome.kind === 'valid' && outcome.record.clientId).toBe('fictional-co');
    expect(outcome.kind === 'valid' && outcome.record.displayName).toBe('Fictional Co');
  });

  it.each([
    ['a blank id', ''],
    ['a path separator', 'a/b'],
    ['a Windows separator', 'a\\b'],
    ['traversal', '..'],
    ['embedded traversal', 'a/../../b'],
    ['an absolute path', '/etc/passwd'],
    ['a drive path', 'C:\\Windows'],
    ['a leading dot', '.hidden'],
    ['a space', 'a b'],
  ])('refuses %s as a client id', (_label, clientId) => {
    const outcome = validateClientRecordDraft(draft({ clientId }));
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.field).toBe('clientId');
  });

  it('refuses an id this console would later be unable to open as a file', () => {
    // ⚠️ The point of sharing `assertSafeClientIdForFileName` with Discovery:
    // an id accepted here and refused there would create a business that exists
    // and cannot be worked on.
    const outcome = validateClientRecordDraft(draft({ clientId: 'ok/../evil' }));
    expect(outcome.kind).toBe('refused');
  });

  it('does NOT echo the rejected id back', () => {
    const hostile = '../<script>alert(1)</script>';
    const outcome = validateClientRecordDraft(draft({ clientId: hostile }));

    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).not.toContain('script');
    expect(outcome.kind === 'refused' && outcome.reason).not.toContain(hostile);
  });

  it('requires an organization id rather than inferring one', () => {
    const outcome = validateClientRecordDraft(draft({ organizationId: '   ' }));
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.field).toBe('organizationId');
  });

  it('requires a display name', () => {
    const outcome = validateClientRecordDraft(draft({ displayName: '' }));
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.field).toBe('displayName');
  });

  it('produces a record the registry’s own parser accepts', () => {
    // ⚠️ The form must not agree with itself and disagree with the loader.
    const outcome = validateClientRecordDraft(draft({ externalRefsText: 'rankops = fic-01' }));
    expect(outcome.kind).toBe('valid');
    if (outcome.kind !== 'valid') return;

    expect(() => parseClientRecord(outcome.record)).not.toThrow();
    expect(outcome.record.externalRefs).toEqual({ rankops: 'fic-01' });
  });

  it('carries no field the operator did not supply', () => {
    // 🚫 No createdAt, no generated id, no createdBy. A record must contain
    // nothing AGE invented.
    const outcome = validateClientRecordDraft(draft());
    if (outcome.kind !== 'valid') throw new Error('expected valid');

    expect(Object.keys(outcome.record).sort()).toEqual([
      'clientId',
      'displayName',
      'externalRefs',
      'organizationId',
    ]);
  });
});

describe('parseExternalRefsText', () => {
  it('treats a blank block as no references, not as an error', () => {
    // A business not yet in any peer product is ordinary, not incomplete.
    const outcome = parseExternalRefsText('\n  \n');
    expect(outcome).toEqual({ kind: 'valid', refs: {} });
  });

  it('reads one pair per line and trims around the separator', () => {
    const outcome = parseExternalRefsText('rankops = fic-01\n  mcp-ads=fic-ads  ');
    expect(outcome.kind === 'valid' && outcome.refs).toEqual({
      rankops: 'fic-01',
      'mcp-ads': 'fic-ads',
    });
  });

  it('keeps an "=" that appears inside the value', () => {
    const outcome = parseExternalRefsText('tracking = a=b=c');
    expect(outcome.kind === 'valid' && outcome.refs).toEqual({ tracking: 'a=b=c' });
  });

  it('refuses a line with no separator, naming the LINE NUMBER only', () => {
    const outcome = parseExternalRefsText('rankops = fic-01\nsecret-account-99');

    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).toContain('Line 2');
    // ⚠️ The line frequently carries a real advertising account id.
    expect(outcome.kind === 'refused' && outcome.reason).not.toContain('secret-account-99');
  });

  it('refuses an empty key or value without echoing the line', () => {
    expect(parseExternalRefsText('= fic-01').kind).toBe('refused');
    expect(parseExternalRefsText('rankops =').kind).toBe('refused');

    const outcome = parseExternalRefsText('rankops =');
    expect(outcome.kind === 'refused' && outcome.reason).toContain('Line 1');
  });

  it('refuses a repeated system rather than letting the last line win', () => {
    const outcome = parseExternalRefsText('rankops = a\nrankops = b');
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).toContain('Line 2');
  });
});

describe('appendClientRecord', () => {
  const existing = [
    parseClientRecord({
      clientId: 'already-here',
      organizationId: 'org-1',
      displayName: 'Already Here',
      externalRefs: {},
    }),
  ];

  it('appends after the records already on file', () => {
    const record = parseClientRecord({
      clientId: 'fictional-co',
      organizationId: 'org-1',
      displayName: 'Fictional Co',
      externalRefs: {},
    });

    const outcome = appendClientRecord(existing, record);
    expect(outcome.kind === 'appended' && outcome.records.map((r) => r.clientId)).toEqual([
      'already-here',
      'fictional-co',
    ]);
  });

  it('refuses a duplicate id rather than replacing the existing business', () => {
    const record = parseClientRecord({
      clientId: 'already-here',
      organizationId: 'org-2',
      displayName: 'A Different Business',
      externalRefs: {},
    });

    const outcome = appendClientRecord(existing, record);
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.field).toBe('clientId');
  });

  it('does not mutate the records it was given', () => {
    const record = parseClientRecord({
      clientId: 'fictional-co',
      organizationId: 'org-1',
      displayName: 'Fictional Co',
      externalRefs: {},
    });

    appendClientRecord(existing, record);
    expect(existing).toHaveLength(1);
  });
});

describe('renderClientRecordFile', () => {
  const records = [
    parseClientRecord({
      clientId: 'fictional-co',
      organizationId: 'org-fictional',
      displayName: 'Fictional Co',
      externalRefs: { rankops: 'fic-01' },
    }),
  ];

  it('produces a file the registry loader accepts', () => {
    // ⚠️ The console writes what the loader reads. There is no second format.
    const text = renderClientRecordFile(records);

    const loaded = loadClientRecordFile({
      path: '/operator/clients.json',
      repositoryRoot: '/repo',
      readFileText: () => text,
    });

    expect(loaded.map((record) => record.clientId)).toEqual(['fictional-co']);
    expect(loaded[0]?.externalRefs).toEqual({ rankops: 'fic-01' });
  });

  it('is stable — re-rendering the same registry is byte-identical', () => {
    expect(renderClientRecordFile(records)).toBe(renderClientRecordFile(records));
  });

  it('carries no timestamp or generated id', () => {
    const text = renderClientRecordFile(records);
    expect(text).not.toMatch(/createdAt|updatedAt|generatedBy|version/);
  });

  it('ends with a newline', () => {
    expect(renderClientRecordFile(records).endsWith('}\n')).toBe(true);
  });
});

describe('the form round-trip', () => {
  it('reads an empty form back as an empty draft', () => {
    expect(clientRecordDraftFromFormEntries({})).toEqual(emptyClientRecordDraft());
  });

  it('reads typed values back verbatim', () => {
    expect(
      clientRecordDraftFromFormEntries({
        clientId: 'fictional-co',
        organizationId: 'org-fictional',
        displayName: 'Fictional Co',
        externalRefsText: 'rankops = fic-01',
      }),
    ).toEqual(draft({ externalRefsText: 'rankops = fic-01' }));
  });
});
