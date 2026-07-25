/**
 * @age/scored-bif-snapshot-persistence — the durable adapter for scored BIF
 * snapshots (ADR-0029 stage 3a, ADR-0031 Decision 2).
 *
 * WHY A NEW PACKAGE. `@age/persistence` is not generalised for this: its base
 * `PersistenceRepository` is `save`/`softDelete` over a `PersistedBase`
 * carrying `updatedAt`, `version` and `deletedAt` — a mutable, soft-deletable
 * shape that contradicts the append-only snapshots ADR-0030 ratified. The
 * contracts package cannot host it either: its purity guard forbids
 * `@prisma/client` outright. The name matched; the shape did not.
 *
 * It shares the single Prisma schema of record —
 * `packages/persistence/src/prisma/schema.prisma` (ADR-0031 D3) — and declares
 * no schema of its own. There is no second source of truth for this table.
 */

export { PrismaScoredBifSnapshotRepository } from './prisma-scored-bif-snapshot-repository';
export { isUniqueConstraintViolation } from './scored-bif-snapshot-delegate';
export type { ScoredBifSnapshotDelegate } from './scored-bif-snapshot-delegate';
export { ScopedScoredBifSnapshotRepository } from './scoped-scored-bif-snapshot-repository';
export type {
  ScoredBifSnapshotScope,
  ScoredBifSnapshotScopeRunner,
} from './scored-bif-snapshot-scope-runner';
export { fromScoredBifSnapshotRow, toScoredBifSnapshotRow } from './scored-bif-snapshot-row';
export type { ScoredBifSnapshotRow } from './scored-bif-snapshot-row';
