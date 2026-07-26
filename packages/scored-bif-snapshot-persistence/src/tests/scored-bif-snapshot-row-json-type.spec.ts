import { describe, expect, it } from 'vitest';
import {
  serializeScoredBifSnapshot,
  toScoredBifSnapshot,
  type JsonObject,
  type JsonValue,
} from '@age/business-discovery-contracts';
import {
  fromScoredBifSnapshotRow,
  toScoredBifSnapshotRow,
  type ScoredBifSnapshotRow,
  type StoredScoredBifSnapshotRow,
} from '../scored-bif-snapshot-row';
import { makeRecord, sampleContext, SCOPE } from './scored-bif-snapshot-repository-contract';

/**
 * The JSON type boundary of `ScoredBifSnapshotRow.context` (ADR-0041).
 *
 * Most of what this file asserts is asserted at COMPILE time, by
 * `@ts-expect-error`. That is deliberate and it is not a weaker test than a
 * runtime one: an unused `@ts-expect-error` is itself a compile error, so `tsc`
 * fails if any of these stop being rejected. The runtime `expect`s that
 * accompany them exist so the file also reports something when run.
 *
 * The boundary is asymmetric on purpose (ADR-0041 D1). A row being WRITTEN is a
 * JSON object the caller is asserting; a row READ BACK is untrusted data of
 * whatever shape the column actually holds.
 */

const COLUMNS = {
  ...SCOPE,
  bifId: 'bif-1',
  snapshotId: 'snap-1',
  capturedAt: '2026-07-15T09:30:00.000Z',
  snapshotVersion: '1.0.0',
  scoringVersion: null,
} as const;

describe('scored BIF snapshot row context JSON type (ADR-0041)', () => {
  describe('the write shape accepts JSON objects', () => {
    it('accepts a real ScoredBifContext through the mapper', () => {
      const row: ScoredBifSnapshotRow = toScoredBifSnapshotRow(makeRecord());

      expect(row.context).toBe(sampleContext() && row.context);
      expect(typeof row.context).toBe('object');
      expect((row.context as { bifId?: unknown }).bifId).toBe(sampleContext().bifId);
    });

    it('accepts a plain JSON object, including nested null and arrays', () => {
      const row: ScoredBifSnapshotRow = {
        ...COLUMNS,
        context: {
          a: 'text',
          b: 1,
          c: true,
          d: null,
          e: [1, 'two', null, { f: [] }],
          g: { h: { i: null } },
        },
      };

      expect(row.context.d).toBeNull();
    });

    it('accepts an object whose members are optional', () => {
      // The `| undefined` on the index signature is what makes a shape like
      // `metadata.scoringVersion?: string` assignable at all.
      const withOptional: JsonObject = { present: 'yes', absent: undefined };

      expect(Object.keys(withOptional)).toContain('absent');
    });
  });

  describe('the write shape rejects everything that is not a JSON object', () => {
    it('rejects top-level arrays, primitives and null (ADR-0041 D2)', () => {
      // A top-level `null` is the concrete hazard: Prisma requires its own
      // `JsonNull` sentinel and does not accept `null` as `InputJsonValue`, so
      // admitting one here would reintroduce the assignability failure ADR-0041
      // exists to remove.
      const rejected = [
        // @ts-expect-error a top-level array is not a snapshot context
        { ...COLUMNS, context: [1, 2, 3] } satisfies ScoredBifSnapshotRow,
        // @ts-expect-error a top-level string is not a snapshot context
        { ...COLUMNS, context: 'text' } satisfies ScoredBifSnapshotRow,
        // @ts-expect-error a top-level number is not a snapshot context
        { ...COLUMNS, context: 1 } satisfies ScoredBifSnapshotRow,
        // @ts-expect-error a top-level boolean is not a snapshot context
        { ...COLUMNS, context: true } satisfies ScoredBifSnapshotRow,
        // @ts-expect-error a top-level null is not a snapshot context
        { ...COLUMNS, context: null } satisfies ScoredBifSnapshotRow,
      ];

      expect(rejected).toHaveLength(5);
    });

    it('rejects values that cannot survive a JSON round trip', () => {
      const rejected = [
        // @ts-expect-error a Date would return as a string, not a Date
        { ...COLUMNS, context: { at: new Date() } } satisfies ScoredBifSnapshotRow,
        // @ts-expect-error a function is not JSON
        { ...COLUMNS, context: { fn: () => 1 } } satisfies ScoredBifSnapshotRow,
        // @ts-expect-error a symbol is not JSON
        { ...COLUMNS, context: { sym: Symbol('s') } } satisfies ScoredBifSnapshotRow,
        // @ts-expect-error a bigint is not JSON
        { ...COLUMNS, context: { big: 1n } } satisfies ScoredBifSnapshotRow,
      ];

      expect(rejected).toHaveLength(4);
    });

    it('still rejects them at runtime, which is what actually proves it', () => {
      // The type level cannot prove this on its own: `ScoredBifContextField.value`
      // is `unknown`, so a context reaching `toScoredBifSnapshotRow` has been
      // validated, not inferred. `toScoredBifSnapshot` is that gate.
      const context = sampleContext();
      const section = context.sections[0];
      if (section === undefined) throw new Error('the sample context has no sections');
      const field = section.fields[0];
      if (field === undefined) throw new Error('the sample section has no fields');

      const poisoned = {
        ...context,
        sections: [{ ...section, fields: [{ ...field, value: new Date() }] }],
      };

      expect(() => toScoredBifSnapshot(poisoned as never)).toThrow(/Date/u);
    });
  });

  describe('the read shape is wider than the write shape (ADR-0041 D1)', () => {
    it('accepts any JSON value, because that is what a column can return', () => {
      const rows: StoredScoredBifSnapshotRow[] = [
        { ...COLUMNS, context: { ok: true } },
        { ...COLUMNS, context: [1, 2, 3] },
        { ...COLUMNS, context: 'text' },
        { ...COLUMNS, context: null },
      ];

      expect(rows).toHaveLength(4);
    });

    it('accepts a write row wherever a read row is expected', () => {
      const written: ScoredBifSnapshotRow = toScoredBifSnapshotRow(makeRecord());
      const read: StoredScoredBifSnapshotRow = written;

      expect(read.snapshotId).toBe('snap-1');
    });

    it('re-validates on the way out rather than trusting the column', () => {
      expect(() => fromScoredBifSnapshotRow({ ...COLUMNS, context: null })).toThrow();
      expect(() => fromScoredBifSnapshotRow({ ...COLUMNS, context: 'not a context' })).toThrow();
    });

    it('round-trips a real row back into a record', () => {
      const record = makeRecord();
      const restored = fromScoredBifSnapshotRow(toScoredBifSnapshotRow(record));

      expect(restored.snapshotId).toBe(record.snapshotId);
      expect(restored.snapshot.context.bifId).toBe(record.snapshot.context.bifId);
    });
  });

  describe('nothing else moved', () => {
    it('leaves the serializer deterministic and byte-stable', () => {
      const context = sampleContext();
      const first = serializeScoredBifSnapshot(toScoredBifSnapshot(context));
      const second = serializeScoredBifSnapshot(toScoredBifSnapshot(sampleContext()));

      expect(first).toBe(second);
      expect(first).toBe(JSON.stringify(JSON.parse(first)));
    });

    it('keeps the context in one column, never shredded (ADR-0031 D7)', () => {
      const row = toScoredBifSnapshotRow(makeRecord());
      const columns = Object.keys(row).sort();

      expect(columns).toEqual([
        'bifId',
        'capturedAt',
        'clientId',
        'context',
        'organizationId',
        'scoringVersion',
        'snapshotId',
        'snapshotVersion',
      ]);
    });

    it('exports one definition of JSON, shared by both directions', () => {
      // `JsonObject` is a `JsonValue`; the write shape is a narrowing of the
      // read shape, not a competing vocabulary (ADR-0041 D3).
      const object: JsonObject = { a: 1 };
      const value: JsonValue = object;

      expect(value).toBe(object);
    });
  });
});
