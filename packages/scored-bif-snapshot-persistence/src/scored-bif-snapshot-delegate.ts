import type { ScoredBifSnapshotRow, StoredScoredBifSnapshotRow } from './scored-bif-snapshot-row';

/**
 * The narrowest possible view of the Prisma model delegate for
 * `ScoredBifSnapshot`, declared STRUCTURALLY here rather than imported from
 * `@prisma/client`.
 *
 * WHY NOT IMPORT THE GENERATED TYPE. `@prisma/client` exposes no model
 * delegates until `prisma generate` has run against the schema. Typing this
 * adapter against the generated client would therefore make repository
 * typecheck depend on a generation step, which would in turn require a CI
 * change — explicitly out of scope for this slice. Declaring the shape here
 * keeps the adapter compiling with zero Prisma imports, zero generated code and
 * zero database, while a real `PrismaClient.scoredBifSnapshot` satisfies it
 * structurally at a future composition root.
 *
 * WHAT IS ABSENT IS THE POINT. There is no `update`, no `updateMany`, no
 * `upsert`, no `delete`, no `deleteMany`. The adapter cannot mutate or remove a
 * snapshot because it has been handed no way to express one (ADR-0030,
 * ADR-0031 Decisions 6 and 8). Widening this interface is the mutation, and it
 * would need its own ADR.
 */
export interface ScoredBifSnapshotDelegate {
  create(args: { readonly data: ScoredBifSnapshotRow }): Promise<unknown>;

  findUnique(args: {
    readonly where: {
      readonly clientId_organizationId_bifId_snapshotId: {
        readonly clientId: string;
        readonly organizationId: string;
        readonly bifId: string;
        readonly snapshotId: string;
      };
    };
  }): Promise<StoredScoredBifSnapshotRow | null>;

  findMany(args: {
    readonly where: {
      readonly clientId: string;
      readonly organizationId: string;
      readonly bifId: string;
    };
    /**
     * A MUTABLE array, deliberately (ADR-0041 D4). Prisma's generated `orderBy`
     * input is a mutable array type, and a `ReadonlyArray` is not assignable to
     * it — so a `readonly` declaration here was a second, independent reason the
     * generated delegate did not satisfy this interface. PR #109 reported
     * `create` as the single point of rejection; that was true of `create` in
     * isolation and incomplete for the interface as a whole. This is a variance
     * fix, not a capability change: no method is added.
     */
    readonly orderBy: Array<
      { readonly capturedAt: 'asc' | 'desc' } | { readonly snapshotId: 'asc' | 'desc' }
    >;
    readonly take?: number;
  }): Promise<StoredScoredBifSnapshotRow[]>;
}

/**
 * Prisma's unique-constraint violation. The primary key
 * `(clientId, organizationId, bifId, snapshotId)` is what actually rejects a
 * re-used `snapshotId`, so the adapter recognises the database's own answer
 * rather than pre-checking with a `findUnique` — a read-then-write that two
 * concurrent appends would both pass.
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
