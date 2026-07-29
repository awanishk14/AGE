import { z } from 'zod';
import {
  assertReadableSnapshotVersion,
  scoredBifSnapshotSchema,
  toScoredBifSnapshot,
  type ScoredBifSnapshot,
} from './scored-bif-snapshot';

/**
 * ScoredBifSnapshotRepository — the storage-neutral port for scored BIF
 * snapshots (ADR-0029 stage 2, ADR-0030 Accepted).
 *
 * WHAT THIS IS. An interface plus the record shape it stores, and nothing else.
 * It says what a snapshot store must be able to do; it says nothing about how.
 * The only adapter in this slice is the in-memory one beside it.
 *
 * WHAT THIS IS NOT. There is **no durable write anywhere on this track**. The
 * hard boundary "no DB/persistence writes" stays in force: ADR-0029 stages a
 * durable adapter as stage 3, behind its own Accepted ADR. Nothing here opens a
 * connection, reads a clock, or touches a disk.
 *
 * APPEND-ONLY (ADR-0030). Snapshots are immutable. This port deliberately has
 * **no `update` and no `delete`** — not as an omission to be filled in later,
 * but as the decision itself. Score history is the reason to persist a
 * confidence score at all, and an in-place row silently rewrites that history
 * the moment `BIF_CONFIDENCE_SCORING_VERSION` changes: the score you recorded
 * stops being a score you can explain. A "current snapshot" pointer is
 * derivable from an append log; a log is not recoverable from an overwritten
 * row. Any future erasure path (a legal right-to-be-forgotten, say) is a
 * separate concern and must not arrive disguised as an `update`.
 *
 * IDENTITY (ADR-0030). A stored snapshot is identified by scope
 * (`clientId`, `organizationId`) + subject (`bifId`) + member (`snapshotId`),
 * ordered by `capturedAt`. The first three name the **series**; `snapshotId`
 * names one **member** of it.
 *
 * SCOPE IS AUTHORITATIVE, NEVER INFERRED. `clientId` and `organizationId` must
 * come from the caller's `ClientContext` (ADR-0009 — capabilities never load
 * the Client aggregate, they are handed the two ids they need for scoping).
 * They are never read out of the snapshot payload, which carries no client and
 * no organization anyway. `clientId` is part of the key because snapshot
 * persistence is client-scoped platform data, even though the BIF payload
 * itself primarily carries `organizationId`.
 *
 * WHY THE PORT TAKES TWO IDS, NOT A `ClientContext`. ADR-0030 left this
 * mechanical choice to this slice. `ClientContext` is a class in
 * `@age/capability-kit`; this package is a contracts package that
 * capability-kit's consumers depend on, so importing it here would invert the
 * dependency direction for no gain. The port takes the two ids structurally —
 * a caller holding a `ClientContext` passes `context.clientId` and
 * `context.organizationId` — which satisfies "scope comes from `ClientContext`"
 * without a second tenancy concept or a package cycle.
 *
 * WHY THE PORT LIVES HERE AND NOT IN `@age/persistence`. On the evidence:
 * `@age/persistence` is architecture-only (its `schema.prisma` declares zero
 * models), its interfaces are BKG/strategy-shaped and depend on
 * `@age/business-knowledge-graph`, and its base `PersistenceRepository` is
 * `save`/`softDelete` — a mutable, soft-delete-aware shape that directly
 * contradicts ADR-0030's append-only decision. It also has no runtime caller:
 * outside its own package it is named only by specs that list it as a
 * **forbidden** import for the demo path. Putting an append-only BIF port there
 * would mean either fighting its base interface or widening a package the
 * boundary tests currently keep out. ADR-0029 part 4 left the host to this
 * slice, to be decided on evidence; the evidence says here.
 *
 * CALLER-SUPPLIED IDENTITY AND TIME (ADR-0030, following ADR-0026 Decision 2).
 * `snapshotId` and `capturedAt` are **inputs**. The port mints no id, reads no
 * clock and uses no randomness, exactly as `producedAt` is supplied to a
 * capability output and `constructedAt` / `changedBy` are supplied to the
 * mapper. This is what keeps the whole track deterministic and testable.
 *
 * `scoringVersion` is an attribute of a snapshot, queryable through the context
 * it already lives on. It is never part of the key — keying on it would forbid
 * re-scoring twice under one version, which is a normal thing to do.
 */

/** Semver of the stored record shape. Bump when the record shape changes. */
export const SCORED_BIF_SNAPSHOT_RECORD_VERSION = '1.0.0';

/**
 * The scope a snapshot is owned by. Both ids MUST be taken from the caller's
 * `ClientContext` (ADR-0009) and are authoritative — a snapshot is never
 * readable outside the scope it was appended in.
 */
export interface ScoredBifSnapshotScope {
  readonly clientId: string;
  readonly organizationId: string;
}

/**
 * Scope + subject: the series of snapshots taken of one BIF for one client.
 * "The current scored BIF" is a query over this series, not a row.
 */
export interface ScoredBifSnapshotSeriesKey extends ScoredBifSnapshotScope {
  readonly bifId: string;
}

/** Full identity of exactly one stored snapshot: the series plus the member. */
export interface ScoredBifSnapshotKey extends ScoredBifSnapshotSeriesKey {
  readonly snapshotId: string;
}

/**
 * One stored snapshot: its identity, when it was captured, and the snapshot
 * itself. Immutable once appended.
 */
export interface ScoredBifSnapshotRecord extends ScoredBifSnapshotKey {
  /**
   * Caller-supplied capture time, as a canonical ISO-8601 UTC instant
   * (`YYYY-MM-DDTHH:mm:ss.sssZ` — what `Date.prototype.toISOString` emits).
   *
   * A string rather than a `Date` on purpose: the snapshot payload beneath it
   * is deliberately `Date`-free and JSON-safe, and a record that is half
   * JSON-safe is a record that changes meaning in storage. Pinning the format
   * also makes lexicographic order agree with chronological order, so "latest"
   * is well-defined without parsing anything.
   */
  readonly capturedAt: string;
  readonly snapshot: ScoredBifSnapshot;
}

/**
 * Canonical ISO-8601 UTC instant, to millisecond precision, `Z` only.
 *
 * Deliberately strict. Accepting offsets or variable precision would break the
 * lexicographic ordering "latest" relies on, and accepting anything parseable
 * would let two spellings of the same instant sort differently.
 */
const CAPTURED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const nonEmpty = (field: string) => z.string().trim().min(1, `${field} must be a non-empty string`);

export const scoredBifSnapshotScopeSchema = z.object({
  clientId: nonEmpty('clientId'),
  organizationId: nonEmpty('organizationId'),
});

export const scoredBifSnapshotSeriesKeySchema = scoredBifSnapshotScopeSchema.extend({
  bifId: nonEmpty('bifId'),
});

export const scoredBifSnapshotKeySchema = scoredBifSnapshotSeriesKeySchema.extend({
  snapshotId: nonEmpty('snapshotId'),
});

export const scoredBifSnapshotRecordSchema = scoredBifSnapshotKeySchema.extend({
  capturedAt: z
    .string()
    .regex(
      CAPTURED_AT_PATTERN,
      'capturedAt must be a canonical ISO-8601 UTC instant (YYYY-MM-DDTHH:mm:ss.sssZ)',
    ),
  snapshot: scoredBifSnapshotSchema,
});

/**
 * ScoredBifSnapshotRepository — append and read. No update. No delete.
 *
 * Every read is scoped: a record appended under one scope is invisible under
 * any other, so cross-client leakage is a structural impossibility rather than
 * a rule an adapter is trusted to remember.
 *
 * Promise-returning because a stage-3 durable adapter necessarily is; the
 * in-memory adapter simply resolves immediately. That keeps the port's shape
 * stable across the boundary ADR-0029 has not yet opened.
 */
export interface ScoredBifSnapshotRepository {
  /**
   * Append one immutable snapshot.
   *
   * @throws if the record is structurally invalid, if its snapshot cannot
   * survive a JSON round trip, or if the same `snapshotId` already exists in
   * the same series. A repeated id is a caller bug: with append-only storage
   * the id names one member, and silently accepting it would either duplicate
   * history or overwrite it — and overwriting is the one thing this port does
   * not do.
   */
  append(record: ScoredBifSnapshotRecord): Promise<void>;

  /** One snapshot by full identity, or `null` when the scope holds no such member. */
  findBySnapshotId(key: ScoredBifSnapshotKey): Promise<ScoredBifSnapshotRecord | null>;

  /**
   * The whole series, oldest first, ordered by `capturedAt` and then by
   * `snapshotId` so records captured in the same millisecond still have a
   * stable, reproducible order. Empty when the series has no members.
   */
  listSeries(key: ScoredBifSnapshotSeriesKey): Promise<ReadonlyArray<ScoredBifSnapshotRecord>>;

  /**
   * The most recently captured member of the series, or `null` when empty.
   *
   * This is the append-only answer to "the current scored BIF": a query, not a
   * mutable row. It reports what was captured last; it says nothing about
   * whether the BIF may be promoted from `Draft` to `Active`, which stays
   * undecided and out of scope.
   */
  findLatest(key: ScoredBifSnapshotSeriesKey): Promise<ScoredBifSnapshotRecord | null>;
}

/**
 * Stable string form of a series key, for adapters that need to bucket records.
 *
 * The ids are length-prefixed rather than merely joined: a plain delimiter
 * would let `{clientId: 'a:b', organizationId: 'c'}` and
 * `{clientId: 'a', organizationId: 'b:c'}` collide onto one key, quietly
 * merging two clients' history.
 */
export function scoredBifSnapshotSeriesKeyOf(key: ScoredBifSnapshotSeriesKey): string {
  return [key.clientId, key.organizationId, key.bifId]
    .map((part) => `${part.length}:${part}`)
    .join('|');
}

/**
 * Validate a record at the port boundary and return a defensive, JSON-safe
 * copy, so an adapter stores something a caller can no longer reach into.
 *
 * The snapshot is re-checked with `toScoredBifSnapshot`, which rejects values
 * that cannot survive JSON (a `Date`, `undefined`, `NaN`, a class instance, a
 * cycle). Schema validation alone would not catch those: a field `value` is
 * `unknown` by design, so the shape is satisfied while the meaning would still
 * change in storage.
 *
 * @throws if the record is structurally invalid or its snapshot is not
 * JSON-safe.
 */
export function normalizeScoredBifSnapshotRecord(
  record: ScoredBifSnapshotRecord,
): ScoredBifSnapshotRecord {
  const parsed = scoredBifSnapshotRecordSchema.safeParse(record);
  if (!parsed.success) {
    throw new Error(
      `A ScoredBifSnapshotRecord must be valid before it is stored: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'} ${issue.message}`)
        .join('; ')}`,
    );
  }

  // ADR-0044 D4. This function is the gate on BOTH directions: an adapter calls
  // it before a write, and `fromScoredBifSnapshotRow` calls it on every read.
  // Schema validation accepts `snapshotVersion` as any string, so without this
  // a row stored under a future major would be read back and handed to a caller
  // as though this build understood it.
  assertReadableSnapshotVersion(
    record.snapshot.snapshotVersion,
    'normalizeScoredBifSnapshotRecord',
  );

  // Re-runs the stage-1 JSON-safety assertions over every field value.
  const snapshot = toScoredBifSnapshot(record.snapshot.context);

  return Object.freeze({
    clientId: record.clientId,
    organizationId: record.organizationId,
    bifId: record.bifId,
    snapshotId: record.snapshotId,
    capturedAt: record.capturedAt,
    snapshot: Object.freeze({
      snapshotVersion: record.snapshot.snapshotVersion,
      context: JSON.parse(JSON.stringify(snapshot.context)) as ScoredBifSnapshot['context'],
    }),
  });
}
