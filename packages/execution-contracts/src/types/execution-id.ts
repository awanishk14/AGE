/**
 * ExecutionId — a stable, opaque identity for one execution (ADR-0021 §2).
 *
 * Branded so a raw string cannot be passed where an ExecutionId is expected.
 * Ids are derived deterministically from origin + target (see
 * `deriveExecutionId`) so the same approved request always yields the same id —
 * giving deterministic idempotency at the pure-function level without any
 * dedup store (dedup semantics are deferred to a future ADR).
 */
export type ExecutionId = string & { readonly __brand: 'ExecutionId' };

/** Wrap a non-empty string as an ExecutionId. */
export function executionId(value: string): ExecutionId {
  if (value.trim().length === 0) {
    throw new Error('ExecutionId must be a non-empty string');
  }
  return value as ExecutionId;
}
