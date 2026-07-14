/**
 * ExecutionRejectionReason — deterministic, surfaced reasons a request does not
 * proceed to dry-run fulfillment. Reasons are never dropped silently; they are
 * carried on the guard decision and the resulting audit record.
 */
export enum ExecutionRejectionReason {
  /** Not explicitly approved by a human (or approver missing). → BLOCKED */
  UNAPPROVED = 'UNAPPROVED',
  /** Target execution domain is not a known ExecutionDomain. → REJECTED */
  INVALID_EXECUTION_DOMAIN = 'INVALID_EXECUTION_DOMAIN',
  /** Target scope is missing an organization or client. → REJECTED */
  INVALID_SCOPE = 'INVALID_SCOPE',
  /** Intent has no origin (missing source capability-output item / capability). → REJECTED */
  MISSING_ORIGIN = 'MISSING_ORIGIN',
}
