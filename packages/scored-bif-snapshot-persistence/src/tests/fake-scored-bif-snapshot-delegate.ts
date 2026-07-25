import type { ScoredBifSnapshotDelegate } from '../scored-bif-snapshot-delegate';
import type { ScoredBifSnapshotRow } from '../scored-bif-snapshot-row';

/**
 * A test double for the `scored_bif_snapshots` table.
 *
 * It emulates only the two behaviours the adapter actually depends on: the
 * composite primary key rejecting a duplicate with Prisma's `P2002`, and
 * `orderBy` / `take`. It is NOT a claim that the adapter has been proven
 * against PostgreSQL — see `README.md`. What it does prove is that the adapter
 * issues correctly scoped, correctly ordered, insert-only queries, which is the
 * part that would otherwise only be checked by reading the code.
 */
export class FakeScoredBifSnapshotDelegate implements ScoredBifSnapshotDelegate {
  /** Insert order, deliberately unsorted — every ordering must come from a query. */
  private readonly rows: ScoredBifSnapshotRow[] = [];

  /** Every call the adapter made, so a test can assert what it did NOT ask for. */
  readonly calls: Array<{ readonly method: string; readonly args: unknown }> = [];

  async create(args: { readonly data: ScoredBifSnapshotRow }): Promise<unknown> {
    this.calls.push({ method: 'create', args });

    const { data } = args;
    const duplicate = this.rows.some(
      (row) =>
        row.clientId === data.clientId &&
        row.organizationId === data.organizationId &&
        row.bifId === data.bifId &&
        row.snapshotId === data.snapshotId,
    );

    if (duplicate) {
      throw Object.assign(
        new Error(
          'Unique constraint failed on the fields: (`client_id`,`organization_id`,`bif_id`,`snapshot_id`)',
        ),
        { code: 'P2002' },
      );
    }

    // Stored by value: the table does not hold the caller's object.
    this.rows.push({ ...data, context: JSON.parse(JSON.stringify(data.context)) as unknown });

    return { count: 1 };
  }

  async findUnique(args: {
    readonly where: {
      readonly clientId_organizationId_bifId_snapshotId: {
        readonly clientId: string;
        readonly organizationId: string;
        readonly bifId: string;
        readonly snapshotId: string;
      };
    };
  }): Promise<ScoredBifSnapshotRow | null> {
    this.calls.push({ method: 'findUnique', args });

    const key = args.where.clientId_organizationId_bifId_snapshotId;

    return (
      this.rows.find(
        (row) =>
          row.clientId === key.clientId &&
          row.organizationId === key.organizationId &&
          row.bifId === key.bifId &&
          row.snapshotId === key.snapshotId,
      ) ?? null
    );
  }

  async findMany(args: {
    readonly where: {
      readonly clientId: string;
      readonly organizationId: string;
      readonly bifId: string;
    };
    readonly orderBy: ReadonlyArray<
      { readonly capturedAt: 'asc' | 'desc' } | { readonly snapshotId: 'asc' | 'desc' }
    >;
    readonly take?: number;
  }): Promise<ScoredBifSnapshotRow[]> {
    this.calls.push({ method: 'findMany', args });

    const { where, orderBy, take } = args;

    const matched = this.rows.filter(
      (row) =>
        row.clientId === where.clientId &&
        row.organizationId === where.organizationId &&
        row.bifId === where.bifId,
    );

    const sorted = [...matched].sort((left, right) => {
      for (const term of orderBy) {
        const field: 'capturedAt' | 'snapshotId' =
          'capturedAt' in term ? 'capturedAt' : 'snapshotId';
        const direction = 'capturedAt' in term ? term.capturedAt : term.snapshotId;
        const comparison = left[field].localeCompare(right[field]);
        if (comparison !== 0) {
          return direction === 'asc' ? comparison : -comparison;
        }
      }

      return 0;
    });

    return take === undefined ? sorted : sorted.slice(0, take);
  }
}
