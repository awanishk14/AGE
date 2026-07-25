import {
  normalizeScoredBifSnapshotRecord,
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
export interface ScoredBifSnapshotRow {
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
  /** The whole `ScoredBifContext`, one `jsonb` column, never shredded (D7). */
  readonly context: unknown;
}

/**
 * Record → row. Takes the scope from the record's KEY, never from the payload
 * (ADR-0031 D5): `context.bifId` is deliberately not consulted, and the context
 * carries no client or organization to consult in the first place.
 */
export function toScoredBifSnapshotRow(record: ScoredBifSnapshotRecord): ScoredBifSnapshotRow {
  const context = record.snapshot.context;

  return Object.freeze({
    clientId: record.clientId,
    organizationId: record.organizationId,
    bifId: record.bifId,
    snapshotId: record.snapshotId,
    capturedAt: record.capturedAt,
    snapshotVersion: record.snapshot.snapshotVersion,
    scoringVersion: context.metadata.scoringVersion ?? null,
    context,
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
 */
export function fromScoredBifSnapshotRow(row: ScoredBifSnapshotRow): ScoredBifSnapshotRecord {
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
  } as ScoredBifSnapshotRecord);
}
