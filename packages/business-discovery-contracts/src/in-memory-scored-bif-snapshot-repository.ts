import {
  normalizeScoredBifSnapshotRecord,
  scoredBifSnapshotSeriesKeyOf,
  type ScoredBifSnapshotKey,
  type ScoredBifSnapshotRecord,
  type ScoredBifSnapshotRepository,
  type ScoredBifSnapshotSeriesKey,
} from './scored-bif-snapshot-repository';

/**
 * InMemoryScoredBifSnapshotRepository — the only adapter ADR-0030 authorizes
 * (ADR-0029 stage 2).
 *
 * WHAT THIS IS. A `Map` behind the port. It exists so the port can be exercised
 * and so callers can be written and tested before any store exists — and so
 * that when a durable adapter is eventually proposed, its behaviour has a
 * reference to match rather than a specification to interpret.
 *
 * WHAT THIS IS NOT. Not persistence. Nothing here survives the process: no
 * file, no database, no network, no environment read. The hard boundary "no
 * DB/persistence writes" is untouched, and a durable adapter still requires its
 * own Accepted ADR (ADR-0029 stage 3).
 *
 * APPEND-ONLY. There is no `update` and no `delete`, because the port has
 * neither (ADR-0030). Appending an id the series already holds is rejected
 * rather than absorbed.
 *
 * DETERMINISTIC. No clock, no randomness, no I/O. `capturedAt` and `snapshotId`
 * arrive from the caller, and ties are broken by `snapshotId`, so the same
 * sequence of appends always yields the same reads in the same order. The
 * adapter holds state — that is its whole job — but it never invents any.
 *
 * ISOLATED BY SCOPE. Records are bucketed by the full series key, so a snapshot
 * appended for one client is not reachable from another client's reads. That is
 * a property of the data structure here, not a convention to be observed.
 */
export class InMemoryScoredBifSnapshotRepository implements ScoredBifSnapshotRepository {
  /** Series key -> that series' members, in append order. */
  private readonly series = new Map<string, ScoredBifSnapshotRecord[]>();

  /**
   * Append one immutable snapshot.
   *
   * @throws if the record is invalid or not JSON-safe, or if `snapshotId`
   * already exists in this series.
   */
  async append(record: ScoredBifSnapshotRecord): Promise<void> {
    const stored = normalizeScoredBifSnapshotRecord(record);
    const key = scoredBifSnapshotSeriesKeyOf(stored);
    const members = this.series.get(key) ?? [];

    if (members.some((member) => member.snapshotId === stored.snapshotId)) {
      throw new Error(
        `Snapshot '${stored.snapshotId}' already exists for BIF '${stored.bifId}' in this scope. Snapshots are append-only and are never overwritten (ADR-0030).`,
      );
    }

    this.series.set(key, [...members, stored]);
  }

  async findBySnapshotId(key: ScoredBifSnapshotKey): Promise<ScoredBifSnapshotRecord | null> {
    const members = this.series.get(scoredBifSnapshotSeriesKeyOf(key)) ?? [];
    return members.find((member) => member.snapshotId === key.snapshotId) ?? null;
  }

  async listSeries(
    key: ScoredBifSnapshotSeriesKey,
  ): Promise<ReadonlyArray<ScoredBifSnapshotRecord>> {
    const members = this.series.get(scoredBifSnapshotSeriesKeyOf(key)) ?? [];
    // Sorts a copy: the stored order is append order and stays untouched.
    return [...members].sort(compareByCaptureThenId);
  }

  async findLatest(key: ScoredBifSnapshotSeriesKey): Promise<ScoredBifSnapshotRecord | null> {
    const ordered = await this.listSeries(key);
    return ordered.length === 0 ? null : (ordered[ordered.length - 1] ?? null);
  }
}

/**
 * Oldest first by `capturedAt`, then by `snapshotId`.
 *
 * `capturedAt` is a pinned canonical ISO-8601 UTC format, so comparing the
 * strings is comparing the instants — no parsing, no clock. The `snapshotId`
 * tie-break matters: two snapshots can legitimately share a millisecond, and
 * "latest" must still be one specific record every time it is asked.
 */
function compareByCaptureThenId(
  left: ScoredBifSnapshotRecord,
  right: ScoredBifSnapshotRecord,
): number {
  if (left.capturedAt !== right.capturedAt) {
    return left.capturedAt < right.capturedAt ? -1 : 1;
  }
  if (left.snapshotId === right.snapshotId) {
    return 0;
  }
  return left.snapshotId < right.snapshotId ? -1 : 1;
}
