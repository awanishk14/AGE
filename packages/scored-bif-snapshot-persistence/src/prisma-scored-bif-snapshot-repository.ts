import {
  normalizeScoredBifSnapshotRecord,
  type ScoredBifSnapshotKey,
  type ScoredBifSnapshotRecord,
  type ScoredBifSnapshotRepository,
  type ScoredBifSnapshotSeriesKey,
} from '@age/business-discovery-contracts';
import {
  isUniqueConstraintViolation,
  type ScoredBifSnapshotDelegate,
} from './scored-bif-snapshot-delegate';
import { fromScoredBifSnapshotRow, toScoredBifSnapshotRow } from './scored-bif-snapshot-row';

/**
 * PrismaScoredBifSnapshotRepository — the durable adapter behind the existing
 * `ScoredBifSnapshotRepository` port (ADR-0029 stage 3a, ADR-0031).
 *
 * IT IMPLEMENTS THE PORT UNCHANGED. `append`, `findBySnapshotId`, `listSeries`,
 * `findLatest` — the same four operations the in-memory adapter implements. The
 * port needed no redesign to become durable, which is the whole point of having
 * staged it: storage moved, the contract did not.
 *
 * APPEND-ONLY. There is no `update`, no `delete`, no `upsert`, no soft delete
 * and no mutable "current" pointer, in this class or in the delegate it is
 * given (ADR-0030, ADR-0031 D6/D8/D9). "The current scored BIF" is
 * `findLatest` — an ORDER BY over an append log, not a row anyone rewrites.
 *
 * SCOPE IS AUTHORITATIVE, NEVER INFERRED (ADR-0031 D5). Every read carries
 * `clientId` and `organizationId` in its key, so a snapshot appended under one
 * scope is unreachable under another — not by convention but because the query
 * cannot be expressed without the scope. The adapter never reads scope out of
 * the snapshot payload, and never imports `@age/capability-kit`: a caller
 * holding a `ClientContext` passes its two ids.
 *
 * IT IS INERT. No clock, no randomness, no id generation, no connection
 * management: `snapshotId` and `capturedAt` are caller-supplied (ADR-0031 D10),
 * and the delegate is injected. The class does not know whether it is talking
 * to PostgreSQL or to a fake, which is what lets one shared contract suite run
 * against both this adapter and the in-memory one.
 */
export class PrismaScoredBifSnapshotRepository implements ScoredBifSnapshotRepository {
  private readonly snapshots: ScoredBifSnapshotDelegate;

  constructor(snapshots: ScoredBifSnapshotDelegate) {
    this.snapshots = snapshots;
  }

  async append(record: ScoredBifSnapshotRecord): Promise<void> {
    // Validated before it reaches storage, and re-frozen JSON-safe, so a caller
    // cannot keep a handle on what was written.
    const stored = normalizeScoredBifSnapshotRecord(record);

    try {
      await this.snapshots.create({ data: toScoredBifSnapshotRow(stored) });
    } catch (error: unknown) {
      if (isUniqueConstraintViolation(error)) {
        throw new Error(
          `Snapshot '${stored.snapshotId}' already exists for BIF '${stored.bifId}' in this scope. ` +
            'Snapshots are append-only and are never overwritten (ADR-0030).',
        );
      }

      throw error;
    }
  }

  async findBySnapshotId(key: ScoredBifSnapshotKey): Promise<ScoredBifSnapshotRecord | null> {
    const row = await this.snapshots.findUnique({
      where: {
        clientId_organizationId_bifId_snapshotId: {
          clientId: key.clientId,
          organizationId: key.organizationId,
          bifId: key.bifId,
          snapshotId: key.snapshotId,
        },
      },
    });

    return row === null ? null : fromScoredBifSnapshotRow(row);
  }

  async listSeries(
    key: ScoredBifSnapshotSeriesKey,
  ): Promise<ReadonlyArray<ScoredBifSnapshotRecord>> {
    const rows = await this.snapshots.findMany({
      where: { clientId: key.clientId, organizationId: key.organizationId, bifId: key.bifId },
      // `snapshotId` breaks ties so two snapshots captured in the same
      // millisecond still have one reproducible order.
      orderBy: [{ capturedAt: 'asc' }, { snapshotId: 'asc' }],
    });

    return Object.freeze(rows.map(fromScoredBifSnapshotRow));
  }

  async findLatest(key: ScoredBifSnapshotSeriesKey): Promise<ScoredBifSnapshotRecord | null> {
    const rows = await this.snapshots.findMany({
      where: { clientId: key.clientId, organizationId: key.organizationId, bifId: key.bifId },
      orderBy: [{ capturedAt: 'desc' }, { snapshotId: 'desc' }],
      take: 1,
    });

    const [row] = rows;

    return row === undefined ? null : fromScoredBifSnapshotRow(row);
  }
}
