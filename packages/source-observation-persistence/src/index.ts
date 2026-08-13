/**
 * `@age/source-observation-persistence` — the durable adapter for what an
 * external system OBSERVED (ADR-0069).
 *
 * 🛑 **APPEND-ONLY BY CONSTRUCTION.** The delegate this package declares carries
 * `create` and `findMany` and nothing else, matching the `GRANT SELECT, INSERT`
 * the table itself holds. 🚫 No `update`, no `upsert`, no `delete`, no soft
 * delete, no status column to flip.
 *
 * 🚫 **STORING IS NOT BELIEVING** (ADR-0069 D5), and 🚫 **READING IS NOT BEING
 * AUTHORIZED**: entitlement runs above this, and RLS below it is coherence, not
 * authorization (ADR-0046 D5).
 *
 * It shares the single Prisma schema of record —
 * `packages/persistence/src/prisma/schema.prisma` (ADR-0031 D3) — and declares
 * no schema of its own.
 */

export { PrismaSourceObservationRepository } from './prisma-source-observation-repository';
export { ScopedSourceObservationRepository } from './scoped-source-observation-repository';
export { PrismaSourceObservationScopeRunner } from './source-observation-scope-runner';
export type {
  SourceObservationScope,
  SourceObservationScopeRunner,
  SourceObservationScopeTransaction,
  SourceObservationTransactionSource,
} from './source-observation-scope-runner';
export { isUniqueConstraintViolation } from './source-observation-delegate';
export type {
  SourceObservationDelegate,
  SourceObservationRow,
} from './source-observation-delegate';
export { fromSourceObservationRow, toSourceObservationRow } from './source-observation-row';
