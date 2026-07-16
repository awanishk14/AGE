/**
 * @age/execution-audit-persistence — durable dry-run Execution Foundation
 * audit persistence foundation (ADR-0022 Slice A).
 *
 * This package is the persistence-adapter layer ADR-0022 places outside
 * `@age/execution-contracts`: it consumes that package's frozen types
 * (`ExecutionRequest`, `ExecutionResult`, `ExecutionAuditRecord`, ...) and
 * defines how a dry-run outcome is durably, append-only, tenant-scoped
 * recorded. It adds no database/ORM wiring itself in this slice — only the
 * schema/model shape (`ExecutionAuditPersistedRecord`), the repository port
 * (`ExecutionAuditPersistenceRepository`), and an in-memory reference
 * implementation used to prove and test the port's contract.
 *
 * Hard invariants carried over from ADR-0021/ADR-0022:
 * - `sideEffectsPerformed` is always `false` — dry-run/no-op only.
 * - No API route, Web UI, approval endpoint, or execute endpoint is added
 *   here (Slices B/C/D/E, each separately decided).
 * - No queue/worker/scheduler, no external integration, no real execution.
 */
export type { ExecutionAuditPersistedRecord } from './types';
export { toPersistedExecutionAuditRecord } from './factory';
export type { ExecutionAuditPersistenceRepository } from './interfaces';
export { InMemoryExecutionAuditRepository } from './repository';
