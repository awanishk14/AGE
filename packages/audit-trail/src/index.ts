/**
 * `@age/audit-trail` — ADR-0061 **A6 item 6**: who logged in, what was read,
 * **retrievable**.
 *
 * 🛑 **A FAILURE IS RECORDED AS LOUDLY AS A SUCCESS** — the refusals before the
 * one success are the attack. 🚫 **AN ENTRY CARRIES NO SECRET AND NO COPY OF THE
 * DATA**: it names what was read by identifier, never its contents, and a guard
 * refuses a field named like one. 🚫 **THERE IS NO WAY TO TURN IT OFF**, and
 * 🚫 no edit, redaction or deletion.
 *
 * ⚠️ **AN AUDIT READ IS ITSELF TENANT-SCOPED** (A6 item 5). 🛑 An entry with no
 * organization is unreachable here on purpose — it is the operator's, and a
 * surface for it needs its own ADR.
 *
 * Pure: every instant and identifier arrives as a parameter. 🚫 No store, no
 * clock, and no caller — the wiring is the deployment composition's slice.
 */

export {
  AUDIT_EVENTS,
  AuditEntryRefusedError,
  recordAuditEntry,
  type AuditActor,
  type AuditEntry,
  type AuditEvent,
  type AuditTarget,
  type RecordAuditEntryInput,
} from './audit-entry';
export { selectTenantAuditEntries, type AuditQuery } from './audit-retrieval';
