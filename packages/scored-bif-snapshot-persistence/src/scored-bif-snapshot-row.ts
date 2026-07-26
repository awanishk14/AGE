import {
  normalizeScoredBifSnapshotRecord,
  type JsonObject,
  type JsonValue,
  type ScoredBifSnapshotRecord,
} from '@age/business-discovery-contracts';

/**
 * The stored row shape — one row of `scored_bif_snapshots`, exactly as the
 * single Prisma schema of record declares it
 * (`packages/persistence/src/prisma/schema.prisma`, ADR-0031 Decision 3).
 *
 * Note what is NOT here, and cannot be added without amending ADR-0031:
 * `updatedAt`, `version`, `deletedAt`, and any `current` / `isCurrent` flag.
 * Append-only is expressed by the absence of the columns a mutation would need
 * (ADR-0030, ADR-0031 Decisions 6 and 9), not only by a port without `update`.
 */
interface ScoredBifSnapshotRowColumns {
  readonly clientId: string;
  readonly organizationId: string;
  readonly bifId: string;
  readonly snapshotId: string;
  /** Canonical ISO-8601 UTC instant, stored verbatim as text (ADR-0031 D10). */
  readonly capturedAt: string;
  readonly snapshotVersion: string;
  /**
   * Denormalised for querying only. Nullable because
   * `ScoredBifContext.scoringVersion` is optional — a snapshot projected
   * without scoring metadata is not invalid. Never part of the key (ADR-0031
   * D4): keying on it would forbid re-scoring a BIF twice under one version.
   */
  readonly scoringVersion: string | null;
}

/**
 * The row on the way IN (ADR-0041 D1, D2).
 *
 * `context` is a JSON **object**: the whole `ScoredBifContext`, one `jsonb`
 * column, never shredded (ADR-0031 D7). It was `unknown`, which is wider than
 * anything a database accepts and forced every caller handing this type to a
 * generated Prisma delegate to cast the delegate wholesale. A blanket
 * `as unknown as` suppresses more than the JSON mismatch — it would equally
 * suppress a delegate that grew `update` or `delete`, which is the one thing
 * `ScoredBifSnapshotDelegate` exists to withhold.
 */
export interface ScoredBifSnapshotRow extends ScoredBifSnapshotRowColumns {
  readonly context: JsonObject;
}

/**
 * The row on the way OUT (ADR-0041 D1).
 *
 * Wider than the write shape on purpose. A row read back is untrusted data
 * (ADR-0031 D11): it may have been written by an older release, edited by hand,
 * or restored from a backup, so what the column can return is any JSON value —
 * not the object the writer promised. Claiming otherwise would be the read side
 * asserting a guarantee the database does not make.
 */
export interface StoredScoredBifSnapshotRow extends ScoredBifSnapshotRowColumns {
  readonly context: JsonValue;
}

/**
 * Record → row. Takes the scope from the record's KEY, never from the payload
 * (ADR-0031 D5): `context.bifId` is deliberately not consulted, and the context
 * carries no client or organization to consult in the first place.
 *
 * THE ONE REMAINING CONVERSION (ADR-0041 D5), and it is here rather than over a
 * whole delegate. `ScoredBifContext` is not assignable to `JsonObject`, for a
 * reason inside the payload: `ScoredBifContextField.value` is `unknown`, so no
 * type-level projection of a context can prove JSON-safety — a mapped type
 * collapses that leaf to `never`. What proves it instead is runtime validation.
 * `normalizeScoredBifSnapshotRecord` has already rejected `Date`, functions,
 * `undefined`, symbols, non-finite numbers, class instances and cycles by the
 * time a record reaches this function, and the only caller (`append`) runs it
 * first. So the assertion below restates something already checked, once, at a
 * named line — rather than being asserted implicitly over an entire interface.
 */
export function toScoredBifSnapshotRow(record: ScoredBifSnapshotRecord): ScoredBifSnapshotRow {
  const context = record.snapshot.context;
  const jsonContext = context as unknown as JsonObject;

  return Object.freeze({
    clientId: record.clientId,
    organizationId: record.organizationId,
    bifId: record.bifId,
    snapshotId: record.snapshotId,
    capturedAt: record.capturedAt,
    snapshotVersion: record.snapshot.snapshotVersion,
    scoringVersion: context.metadata.scoringVersion ?? null,
    context: jsonContext,
  });
}

/**
 * Row → record, re-validated on the way out (ADR-0031 D11).
 *
 * Stored data is untrusted input. A row can have been written by an older
 * release, edited by hand, or restored from a backup taken under a different
 * contract version, so it is put back through
 * `normalizeScoredBifSnapshotRecord` — the same gate an `append` passes —
 * rather than cast into the record type and believed.
 *
 * The `scoringVersion` COLUMN is not read back. It exists to be queried and
 * indexed; the context is the single source of truth for what the value is, and
 * reading the column instead would let a divergent column silently redefine a
 * stored snapshot.
 *
 * The assertion below is on the ARGUMENT to the validator, not on its result: it
 * says "here is a candidate", and `normalizeScoredBifSnapshotRecord` is what
 * decides whether it is a record. It widened from `as` to `as unknown as` when
 * the read context stopped being `unknown` — a stored `JsonValue` genuinely does
 * not overlap `ScoredBifContext`, which is the honest statement of the situation
 * and precisely why the value is validated rather than believed.
 */
export function fromScoredBifSnapshotRow(row: StoredScoredBifSnapshotRow): ScoredBifSnapshotRecord {
  return normalizeScoredBifSnapshotRecord({
    clientId: row.clientId,
    organizationId: row.organizationId,
    bifId: row.bifId,
    snapshotId: row.snapshotId,
    capturedAt: row.capturedAt,
    snapshot: {
      snapshotVersion: row.snapshotVersion,
      context: row.context,
    },
  } as unknown as ScoredBifSnapshotRecord);
}
