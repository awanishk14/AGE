/**
 * ApprovalStatus — the derived lifecycle state of a human approval decision
 * for one execution request (ADR-0023 Slice D1, "State model").
 *
 * - `pending_review` — no decision has been recorded yet.
 * - `approved_for_dry_run` — a human operator explicitly approved the
 *   request; this authorizes, at most, a dry-run/no-op execution. It is
 *   never named/typed as an execution-authorizing state — see
 *   `ApprovalOutcome` below, which deliberately has no
 *   `approved_for_execution` (or equivalent real-execution) member.
 * - `rejected` — a human operator explicitly declined the request.
 * - `superseded` — an earlier decision on the same execution request has
 *   been replaced by a later one. The earlier record is retained, unmutated,
 *   and marked superseded rather than deleted or edited.
 */
export type ApprovalStatus = 'pending_review' | 'approved_for_dry_run' | 'rejected' | 'superseded';

/**
 * ApprovalOutcome — the explicit decision an operator can record. Deliberately
 * a closed, minimal set: approving only ever authorizes a dry-run/no-op
 * execution. Real (side-effecting) execution authorization is out of scope
 * for this boundary (ADR-0023) and requires a separate future ADR
 * (ADR-0022 Slice E) — no `approved_for_execution`, `approved_for_real_execution`,
 * `execute`, or `run` outcome exists here or may be added without one.
 */
export type ApprovalOutcome = 'approved_for_dry_run' | 'rejected';
