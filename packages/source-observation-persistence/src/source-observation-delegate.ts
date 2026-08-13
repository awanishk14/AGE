/**
 * The narrowest possible view of the Prisma model delegate for
 * `SourceObservation`, declared STRUCTURALLY here rather than imported from
 * `@prisma/client` — the same construction
 * `packages/scored-bif-snapshot-persistence` uses, and for the same reasons.
 *
 * ⚠️ **WHY NOT IMPORT THE GENERATED TYPE.** `@prisma/client` exposes no model
 * delegates until `prisma generate` has run. Typing this adapter against the
 * generated client would make repository typecheck depend on a generation step,
 * and therefore on a CI change. Declared structurally, this compiles with zero
 * Prisma imports, zero generated code and zero database, while a real
 * `PrismaClient.sourceObservation` satisfies it structurally at a composition
 * root.
 *
 * 🛑 **WHAT IS ABSENT IS THE POINT.** There is no `update`, no `updateMany`, no
 * `upsert`, no `delete`, no `deleteMany`. `source_observations` holds
 * `GRANT SELECT, INSERT` and nothing else (ADR-0069 deliverable 2), and this
 * interface says the same thing in TypeScript: an adapter cannot rewrite or
 * retract an observation because it has been handed no way to express one.
 * 🚫 Widening this interface is the mutation, and it would need its own ADR.
 *
 * 🚫 **THERE IS NO `findUnique` EITHER.** Addressing one observation by id is
 * how a surface starts reconciling AGE's copy against the source system's, and
 * ADR-0069 D5 is explicit that arrival is never confirmation. Reading is by
 * organisation, which is the only scope a screen has ever needed.
 */

/** One row as it goes IN. ⚠️ Flat, exactly as the table stores it. */
export interface SourceObservationRow {
  readonly observationId: string;
  readonly organizationId: string;
  readonly sourceSystem: string;
  readonly sourceInstance: string;
  readonly sourceRecordId: string;
  readonly subjectDisposition: string;
  /** 🛑 `null`, 🚫 never `undefined` — an unmapped subject has NO kind, and the
   * column says so explicitly rather than by omission. */
  readonly subjectKind: string | null;
  readonly subjectLabel: string;
  readonly claimDirection: string;
  readonly claimMateriality: string;
  readonly claimKind: string;
  readonly observedAt: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly recordedAt: string;
}

export interface SourceObservationDelegate {
  create(args: { readonly data: SourceObservationRow }): Promise<unknown>;

  findMany(args: {
    readonly where: { readonly organizationId: string };
    /**
     * ⚠️ A MUTABLE array, deliberately: Prisma's generated `orderBy` input is a
     * mutable array type and a `ReadonlyArray` is not assignable to it. A
     * variance fix, 🚫 not a capability change — no method is added.
     */
    readonly orderBy: Array<
      { readonly observedAt: 'asc' | 'desc' } | { readonly observationId: 'asc' | 'desc' }
    >;
  }): Promise<unknown[]>;
}

/**
 * Prisma's unique-constraint violation. `observation_id` is the primary key, so
 * the database itself rejects a re-used id — 🚫 never a read-then-write check,
 * which two concurrent relays would both pass.
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
