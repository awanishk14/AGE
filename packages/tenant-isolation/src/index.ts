/**
 * `@age/tenant-isolation` — ADR-0061 **A6 item 5**, tenant isolation as the
 * **read path's** rule.
 *
 * 🛑 **NOT WRITTEN AGAINST RLS.** Row-level security is a coherence constraint
 * (ADR-0046 D5); it checks the declared scope against the row, 🚫 never that the
 * declared scope is the caller's own. This does that, from the session.
 *
 * 🚫 **A MISMATCH IS REFUSED, NEVER NARROWED**, and 🚫 there is no admin arm
 * (ADR-0062 D3). ⚠️ Rows are re-checked on the way back out, because a stored row
 * is untrusted input.
 *
 * Pure: no clock, no I/O, no database. It has no caller — wiring it is the
 * deployment composition's slice.
 */

export {
  acceptRowWithinTenant,
  acceptSessionScopedClientContext,
  assertRowsWithinTenant,
  TenantIsolationRefusedError,
  type AcceptSessionScopedClientContextInput,
  type TenantScopedRow,
} from './tenant-isolation';
