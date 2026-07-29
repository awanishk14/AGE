import { z } from 'zod';
import { scoredBifContextSchema, type ScoredBifContext } from './scored-bif-context';

/**
 * ScoredBifSnapshot — the versioned, storage-neutral serialized form of a scored
 * BIF context (ADR-0029, Accepted — stage 1 of staged persistence).
 *
 * WHAT THIS IS. A pure codec: a scored `ScoredBifContext` in, a JSON-safe
 * snapshot out, and the identical context back again. Nothing more. It is the
 * prerequisite for persistence, not persistence itself.
 *
 * WHAT THIS IS NOT. There is **no I/O here** — no file, no database, no network,
 * no clock, no environment read. ADR-0029 keeps the hard boundary "no
 * DB/persistence writes" in force and stages the work: this module is stage 1,
 * the repository port is stage 2, and a durable adapter requires its own
 * Accepted ADR. Nothing in this file writes anything anywhere.
 *
 * WHY IT SNAPSHOTS THE CONTEXT, NOT THE LIVE BIF. A
 * `BusinessIntelligenceFramework` carries `Date` values, per-field version
 * `history` and audit actors. Round-tripping those honestly would mean either
 * serializing the whole audit trail — well beyond a scored snapshot — or
 * reconstructing a BIF whose history was invented at load time. The second is
 * fabrication and is forbidden outright. `ScoredBifContext` is already the
 * sanctioned, neutral, `Date`-free projection of a scored BIF (ADR-0026), and it
 * carries exactly what a snapshot must preserve: root and section scores,
 * per-field provenance (`source`/`confidence`), and the omitted sections. So the
 * codec round-trips the projection exactly, and deliberately offers **no**
 * `ScoredBifContext -> BusinessIntelligenceFramework` direction. Restoring a live
 * BIF is not in scope for stage 1 and cannot be done without inventing history.
 *
 * NON-FABRICATION. The codec adds nothing and drops nothing. Omitted sections
 * survive as omitted — they are never materialised into placeholder sections on
 * the way out or the way back. Absent optional values stay absent rather than
 * being defaulted. Scores are copied verbatim and never recomputed, rounded or
 * clamped. Status is carried through; this module never promotes a BIF.
 *
 * DETERMINISM. `toScoredBifSnapshot` is a structural copy and
 * `serializeScoredBifSnapshot` emits object keys in a stable sorted order, so the
 * same context always produces byte-identical JSON. That is what makes a snapshot
 * comparable across runs — without it, "did this BIF change?" is unanswerable.
 */

/**
 * Semver of the snapshot envelope. Bump the major when the shape changes in a
 * way older readers cannot understand; {@link fromScoredBifSnapshot} rejects a
 * major it does not implement rather than guessing at the contents.
 */
export const SCORED_BIF_SNAPSHOT_VERSION = '1.0.0';

/**
 * A scored BIF context wrapped in a versioned envelope. The envelope exists so a
 * stored snapshot can always say what shape it is, independently of whatever
 * store it came out of.
 */
export interface ScoredBifSnapshot {
  /** Semver of the snapshot envelope at the time it was produced. */
  readonly snapshotVersion: string;
  /** The projected scored BIF context, preserved exactly. */
  readonly context: ScoredBifContext;
}

export const scoredBifSnapshotSchema = z.object({
  snapshotVersion: z.string(),
  context: scoredBifContextSchema,
});

/**
 * The subset of JSON values a snapshot may contain (ADR-0041 D3).
 *
 * This is the repository's single definition of "JSON". It was private while it
 * only served `assertJsonSafe`; it is exported because the persistence row type
 * needs the same vocabulary, and two competing definitions of JSON is exactly
 * what ADR-0041 D3 forbids.
 *
 * It is structurally compatible with Prisma's `InputJsonValue` and `JsonValue`
 * without naming either. No generated Prisma type is imported here — this
 * package's purity guard forbids the generated client outright, and finding 2 of
 * ADR-0041 proved the compatibility is structural, so importing it would buy
 * nothing. (That guard is a substring scan over this file's own source, which is
 * why the package specifier is described here rather than spelled.)
 */
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;

/**
 * A JSON **object** — the write-side shape (ADR-0041 D2).
 *
 * Deliberately narrower than `JsonValue`: at the top level an object is accepted
 * and arrays, strings, numbers, booleans and `null` are rejected. Two reasons,
 * and the second is concrete rather than aesthetic. A snapshot context is always
 * an object, so nothing else is a `ScoredBifContext`; and a top-level `null` is
 * not assignable to Prisma's `InputJsonValue` at all — Prisma requires its own
 * `JsonNull` sentinel — so admitting one would reintroduce the very
 * assignability failure ADR-0041 exists to remove.
 *
 * Nested values are unrestricted JSON, `null` and arrays included. The
 * `| undefined` on the index signature is what makes an object with optional
 * members (such as `metadata.scoringVersion?`) assignable.
 */
export interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}

/**
 * Reject anything that cannot survive a JSON round trip *before* it is written,
 * rather than letting `JSON.stringify` silently drop or mangle it.
 *
 * This matters more than it looks: `JSON.stringify` turns `undefined` and
 * functions into holes, `Date` into a string that never comes back as a `Date`,
 * and `NaN`/`Infinity` into `null`. Every one of those is a value quietly
 * changing meaning in storage. A field value that cannot be represented is a
 * real problem with the input, so it is raised as one.
 */
function assertJsonSafe(value: unknown, path: string, seen: ReadonlySet<object>): void {
  if (value === null) return;

  const type = typeof value;
  if (type === 'string' || type === 'boolean') return;

  if (type === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new Error(
        `toScoredBifSnapshot cannot serialize the non-finite number at '${path}': JSON would silently turn it into null.`,
      );
    }
    return;
  }

  if (type === 'undefined') {
    throw new Error(
      `toScoredBifSnapshot cannot serialize 'undefined' at '${path}': JSON would drop it, losing the distinction between absent and present-but-unset.`,
    );
  }

  if (type === 'bigint' || type === 'function' || type === 'symbol') {
    throw new Error(`toScoredBifSnapshot cannot serialize a ${type} at '${path}'.`);
  }

  if (value instanceof Date) {
    throw new Error(
      `toScoredBifSnapshot cannot serialize the Date at '${path}': it would return as a string, not a Date. ScoredBifContext is deliberately Date-free.`,
    );
  }

  if (seen.has(value as object)) {
    throw new Error(`toScoredBifSnapshot cannot serialize the circular reference at '${path}'.`);
  }
  const nested = new Set(seen).add(value as object);

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonSafe(entry, `${path}[${index}]`, nested));
    return;
  }

  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error(
      `toScoredBifSnapshot cannot serialize the class instance at '${path}': only plain JSON values round-trip unchanged.`,
    );
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    assertJsonSafe(entry, `${path}.${key}`, nested);
  }
}

/**
 * toScoredBifSnapshot — wrap a projected scored BIF context in a versioned,
 * JSON-safe snapshot envelope.
 *
 * Pure and non-mutating: the context is carried through by structural reference,
 * nothing is recomputed, and no clock is read. The context is validated against
 * its own schema first, and every field `value` is checked to be JSON-safe, so a
 * snapshot that is produced is a snapshot that round-trips.
 *
 * @throws if the context is structurally invalid, or if any field value cannot
 * survive JSON (a `Date`, `undefined`, `NaN`, a class instance, a cycle) — such
 * a value would change meaning in storage, and quietly rewriting it would
 * violate the non-fabrication rule.
 */
export function toScoredBifSnapshot(context: ScoredBifContext): ScoredBifSnapshot {
  const parsed = scoredBifContextSchema.safeParse(context);
  if (!parsed.success) {
    throw new Error(
      `toScoredBifSnapshot requires a valid ScoredBifContext: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'} ${issue.message}`)
        .join('; ')}`,
    );
  }

  context.sections.forEach((section, sectionIndex) => {
    section.fields.forEach((field, fieldIndex) => {
      assertJsonSafe(
        field.value,
        `sections[${sectionIndex}].fields[${fieldIndex}].value`,
        new Set<object>(),
      );
    });
  });

  return { snapshotVersion: SCORED_BIF_SNAPSHOT_VERSION, context };
}

/** Major component of a semver string, or `null` when it is not parseable. */
function majorVersion(version: string): number | null {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  return Number.isInteger(major) ? major : null;
}

/**
 * assertReadableSnapshotVersion — the single major-version gate (ADR-0044 D4).
 *
 * Reading a snapshot whose major this build does not implement would mean
 * inventing the meaning of fields it has never seen. That refusal must hold on
 * **every** path that returns a stored snapshot to a caller, not only in
 * `fromScoredBifSnapshot`.
 *
 * WHY THIS IS SHARED RATHER THAN DUPLICATED. It was duplicated in effect and
 * absent in fact: `fromScoredBifSnapshot` enforced the gate, but the repository
 * read path (`fromScoredBifSnapshotRow` → `normalizeScoredBifSnapshotRecord`)
 * validated `snapshotVersion` as a bare `z.string()` and never checked the
 * major, so a future `2.x` row was read back with the gate silently bypassed.
 * On an append-only table that can never be migrated in place, that is the
 * failure the codec's own doc comment says it exists to prevent. One function,
 * called from both paths, is what stops the two from drifting apart again.
 *
 * `caller` names the function in the message so a rejection points at the path
 * that hit it, not at a shared helper the reader has to go find.
 *
 * @throws if the major is missing, unparseable, or not the implemented one.
 */
export function assertReadableSnapshotVersion(snapshotVersion: string, caller: string): void {
  const expected = majorVersion(SCORED_BIF_SNAPSHOT_VERSION);
  const actual = majorVersion(snapshotVersion);
  if (actual === null || actual !== expected) {
    throw new Error(
      `${caller} cannot read snapshotVersion '${snapshotVersion}': this reader implements major ${expected}.`,
    );
  }
}

/**
 * fromScoredBifSnapshot — validate a snapshot from storage and return the scored
 * BIF context it holds.
 *
 * Accepts `unknown` on purpose: a snapshot read back from any store is untrusted
 * input and is validated at the boundary, never assumed. Nothing is defaulted,
 * repaired or filled in — an invalid snapshot is rejected rather than silently
 * turned into a plausible-looking context.
 *
 * @throws if the value is not a valid snapshot, or if its `snapshotVersion` has a
 * major this reader does not implement. Reading a future major by guessing would
 * mean inventing the meaning of fields it has never seen.
 */
export function fromScoredBifSnapshot(value: unknown): ScoredBifContext {
  const parsed = scoredBifSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `fromScoredBifSnapshot requires a valid ScoredBifSnapshot: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'} ${issue.message}`)
        .join('; ')}`,
    );
  }

  const snapshot = value as ScoredBifSnapshot;
  assertReadableSnapshotVersion(snapshot.snapshotVersion, 'fromScoredBifSnapshot');

  // The validated snapshot's own context is returned, not the schema's parsed
  // output: Zod strips unknown keys and would rebuild optionals, and the point
  // of this codec is that what went in is exactly what comes out.
  return snapshot.context;
}

/**
 * Recursively rebuild plain objects with their keys in sorted order so
 * `JSON.stringify` emits a stable byte sequence. Arrays keep their order —
 * element order is meaningful data (BIF section order), not formatting.
 */
function withSortedKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(withSortedKeys);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  // `Array.isArray` does not narrow a `readonly` array arm out of the union, so
  // the object arm is named explicitly rather than indexed through the union.
  const object = value as JsonObject;
  const sorted: { [key: string]: JsonValue } = {};
  for (const key of Object.keys(object).sort()) {
    sorted[key] = withSortedKeys(object[key] as JsonValue);
  }
  return sorted;
}

/**
 * serializeScoredBifSnapshot — render a snapshot as deterministic JSON.
 *
 * Object keys are emitted in sorted order, so the same context always yields a
 * byte-identical string regardless of the order its properties happen to be in.
 * That is what makes two snapshots comparable — and what makes "has this scored
 * BIF changed since the last run?" a question with an answer.
 *
 * Storage-neutral by construction: this returns a string. It does not write it.
 */
export function serializeScoredBifSnapshot(snapshot: ScoredBifSnapshot): string {
  return JSON.stringify(withSortedKeys(JSON.parse(JSON.stringify(snapshot)) as JsonValue));
}
