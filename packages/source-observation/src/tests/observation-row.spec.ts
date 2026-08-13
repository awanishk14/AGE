import { describe, expect, it } from 'vitest';

import {
  StoredObservationRefusedError,
  normalizeStoredObservation,
  type StoredSourceObservation,
} from '../observation-row';

/**
 * ⚠️ Obviously fictional throughout (ADR-0053 D3). A fixture that looked like a
 * real client would be client data in the repository, and "more realistic
 * fixtures" is the request this rule exists to refuse.
 */
const MODELLED_ROW: Record<string, unknown> = Object.freeze({
  observationId: 'observation-1',
  organizationId: 'org-fictional-1',
  sourceSystem: 'example-seo-system',
  sourceInstance: 'example-seo-system-instance-1',
  sourceRecordId: 'example-record-1',
  subjectDisposition: 'modelled',
  subjectKind: 'service',
  subjectLabel: 'Widget Polishing',
  claimDirection: 'down',
  claimMateriality: 'substantial',
  claimKind: 'raw-observation',
  observedAt: '2026-07-31T00:00:00.000Z',
  windowStart: '2026-07-01T00:00:00.000Z',
  windowEnd: '2026-07-31T00:00:00.000Z',
  recordedAt: '2026-08-13T00:00:00.000Z',
});

const UNMAPPED_ROW: Record<string, unknown> = Object.freeze({
  ...MODELLED_ROW,
  observationId: 'observation-2',
  subjectDisposition: 'unmapped',
  subjectKind: null,
  subjectLabel: 'widget disposal regulations',
});

const clone = (row: Record<string, unknown>): Record<string, unknown> => ({ ...row });

const without = (row: Record<string, unknown>, column: string): Record<string, unknown> => {
  const next = clone(row);
  delete next[column];
  return next;
};

const withValue = (
  row: Record<string, unknown>,
  column: string,
  value: unknown,
): Record<string, unknown> => ({ ...row, [column]: value });

describe('a well-formed row reads back as exactly what was stored', () => {
  it('reads a modelled subject', () => {
    const expected: StoredSourceObservation = {
      observationId: 'observation-1',
      organizationId: 'org-fictional-1',
      sourceSystem: 'example-seo-system',
      sourceInstance: 'example-seo-system-instance-1',
      sourceRecordId: 'example-record-1',
      subject: { kind: 'modelled', subjectKind: 'service', label: 'Widget Polishing' },
      claim: { direction: 'down', materiality: 'substantial' },
      period: {
        observedAt: '2026-07-31T00:00:00.000Z',
        windowStart: '2026-07-01T00:00:00.000Z',
        windowEnd: '2026-07-31T00:00:00.000Z',
      },
      claimKind: 'raw-observation',
      recordedAt: '2026-08-13T00:00:00.000Z',
    };

    expect(normalizeStoredObservation(clone(MODELLED_ROW))).toEqual(expected);
  });

  it('reads an unmapped subject AS UNMAPPED, 🚫 never as a guessed kind', () => {
    const record = normalizeStoredObservation(clone(UNMAPPED_ROW));

    expect(record.subject).toEqual({
      kind: 'unmapped',
      topicLabel: 'widget disposal regulations',
    });
  });

  it('keeps `recordedAt` distinct from `observedAt` — the relay gap is visible', () => {
    const record = normalizeStoredObservation(clone(MODELLED_ROW));

    expect(record.recordedAt).not.toBe(record.period.observedAt);
  });
});

describe('🚫 an unreadable row is refused, never repaired', () => {
  it.each([
    'observationId',
    'organizationId',
    'sourceSystem',
    'sourceInstance',
    'sourceRecordId',
    'subjectDisposition',
    'subjectLabel',
    'claimDirection',
    'claimMateriality',
    'claimKind',
    'observedAt',
    'windowStart',
    'windowEnd',
    'recordedAt',
  ])('refuses a missing `%s`', (column) => {
    expect(() => normalizeStoredObservation(without(MODELLED_ROW, column))).toThrow(
      new RegExp(`\`${column}\``),
    );
  });

  it.each(['observationId', 'organizationId', 'sourceSystem', 'subjectLabel'])(
    'refuses a blank `%s` — 🚫 a blank string is never a value',
    (column) => {
      expect(() => normalizeStoredObservation(withValue(MODELLED_ROW, column, '   '))).toThrow(
        StoredObservationRefusedError,
      );
    },
  );

  it.each([
    ['claimDirection', 'improved'],
    ['claimMateriality', 'huge'],
    ['claimKind', 'guess'],
    ['subjectKind', 'campaign'],
    ['subjectDisposition', 'partially-modelled'],
  ])('refuses an unrecognised `%s`', (column, value) => {
    expect(() => normalizeStoredObservation(withValue(MODELLED_ROW, column, value))).toThrow(
      new RegExp(`\`${column}\``),
    );
  });

  it.each(['observedAt', 'windowStart', 'windowEnd', 'recordedAt'])(
    'refuses an unparseable `%s`',
    (column) => {
      expect(() => normalizeStoredObservation(withValue(MODELLED_ROW, column, 'July'))).toThrow(
        StoredObservationRefusedError,
      );
    },
  );

  it('refuses an inverted window', () => {
    const inverted = withValue(MODELLED_ROW, 'windowEnd', '2026-06-01T00:00:00.000Z');

    expect(() => normalizeStoredObservation(inverted)).toThrow(/windowEnd/);
  });

  it.each([null, undefined, 'a row', 42, [MODELLED_ROW]])('refuses %s in place of a row', (row) => {
    expect(() => normalizeStoredObservation(row)).toThrow(StoredObservationRefusedError);
  });
});

describe('🛑 the two subject shapes never become each other', () => {
  it('🚫 a modelled row missing its kind does NOT become unmapped', () => {
    // ⚠️ The coercion this test forbids would turn "AGE related this to a
    // service" into "AGE could not relate it", silently, on read.
    expect(() => normalizeStoredObservation(withValue(MODELLED_ROW, 'subjectKind', null))).toThrow(
      /subjectKind/,
    );
  });

  it('🚫 an unmapped row does NOT acquire a kind', () => {
    expect(() =>
      normalizeStoredObservation(withValue(UNMAPPED_ROW, 'subjectKind', 'service')),
    ).toThrow(/subjectKind/);
  });

  it('🚫 an absent `subjectKind` column is not read as `null`', () => {
    // "The column was not selected" must never become "AGE could not relate it".
    expect(() => normalizeStoredObservation(without(UNMAPPED_ROW, 'subjectKind'))).toThrow(
      /subjectKind/,
    );
  });
});

describe('🛑 a refusal names a position, never the data', () => {
  it.each(['organizationId', 'subjectLabel', 'sourceRecordId'])(
    'does not echo the rejected `%s` value',
    (column) => {
      const secret = 'org-secret-value-that-must-not-leak';

      try {
        normalizeStoredObservation(withValue(MODELLED_ROW, column, { leaked: secret }));
        expect.unreachable('the row should have been refused');
      } catch (error) {
        expect(error).toBeInstanceOf(StoredObservationRefusedError);
        expect((error as Error).message).toContain(`\`${column}\``);
        expect((error as Error).message).not.toContain(secret);
      }
    },
  );

  it('does not echo the tenant when some other column is at fault', () => {
    try {
      normalizeStoredObservation(withValue(MODELLED_ROW, 'claimDirection', 'improved'));
      expect.unreachable('the row should have been refused');
    } catch (error) {
      expect((error as Error).message).not.toContain('org-fictional-1');
    }
  });
});

describe('🛑 AGE-INV-PROV-1 — provenance alone changes nothing here', () => {
  it('reads two rows differing only in `sourceSystem` identically but for that field', () => {
    const first = normalizeStoredObservation(
      withValue(MODELLED_ROW, 'sourceSystem', 'example-seo-system'),
    );
    const second = normalizeStoredObservation(
      withValue(MODELLED_ROW, 'sourceSystem', 'example-ads-system'),
    );

    expect({ ...first, sourceSystem: '' }).toEqual({ ...second, sourceSystem: '' });
  });
});
