import { describe, expect, it } from 'vitest';

import { CLIENT_RECORD_FILE_VARIABLE, resolveClientRecordSource } from './client-record-source';

describe('resolveClientRecordSource', () => {
  it('reports NOT CONFIGURED when the variable is absent', () => {
    const source = resolveClientRecordSource({});

    expect(source).toEqual({
      kind: 'not-configured',
      variable: CLIENT_RECORD_FILE_VARIABLE,
    });
  });

  it.each([[''], ['   '], ['\t\n']])(
    'treats a blank value (%j) as NOT CONFIGURED, not as a path',
    (value) => {
      // ⚠️ Load-bearing: an empty string reaching the path policy would be
      // refused for its SHAPE, telling the operator their path is malformed
      // when the truth is that they never set one.
      const source = resolveClientRecordSource({ [CLIENT_RECORD_FILE_VARIABLE]: value });

      expect(source.kind).toBe('not-configured');
    },
  );

  it('passes a configured path through EXACTLY, without trimming or resolving', () => {
    const path = '  /home/operator/age/records.json ';

    const source = resolveClientRecordSource({ [CLIENT_RECORD_FILE_VARIABLE]: path });

    // 🚫 Not trimmed. Repairing the operator's typo means opening a file they
    // did not name.
    expect(source).toEqual({ kind: 'configured', path });
  });

  it('never falls back to another variable or a conventional location', () => {
    const source = resolveClientRecordSource({
      AGE_RECORDS: '/somewhere/records.json',
      HOME: '/home/operator',
      PWD: '/home/operator/age',
    });

    expect(source.kind).toBe('not-configured');
  });

  it('returns a frozen value', () => {
    expect(Object.isFrozen(resolveClientRecordSource({}))).toBe(true);
  });
});
