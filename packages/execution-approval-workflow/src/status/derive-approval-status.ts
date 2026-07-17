import type { ApprovalDecision } from '../types/approval-decision';
import type { ApprovalStatus } from '../types/approval-status';

/**
 * Derive the current `ApprovalStatus` for one execution request from its
 * append-only decision history (ADR-0023 "Latest status derivation").
 *
 * Pure and deterministic: `history` must be in append order (the order the
 * repository returns it in — see `ApprovalDecisionRepository.findByExecutionId`).
 * The latest record in that order is authoritative; every earlier record is
 * implicitly superseded by it. No record is ever mutated to compute this —
 * status is always re-derived from history, never stored as a separate
 * mutable field.
 *
 * - No decisions → `pending_review`.
 * - Latest decision `approved_for_dry_run` → `approved_for_dry_run`.
 * - Latest decision `rejected` → `rejected`.
 */
export function deriveApprovalStatus(history: readonly ApprovalDecision[]): ApprovalStatus {
  const latest = history[history.length - 1];
  if (!latest) {
    return 'pending_review';
  }
  return latest.outcome;
}

/**
 * Derive the status of one specific decision *within* its history: the
 * latest decision reports its own outcome (`approved_for_dry_run` /
 * `rejected`); every earlier decision reports `superseded`, since a later
 * decision on the same execution request replaced it.
 */
export function deriveDecisionStatus(
  history: readonly ApprovalDecision[],
  decision: ApprovalDecision,
): ApprovalStatus {
  const latest = history[history.length - 1];
  if (!latest || latest.id !== decision.id) {
    return 'superseded';
  }
  return latest.outcome;
}
