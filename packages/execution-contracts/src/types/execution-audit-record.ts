import type { Capability, ExecutionDomain } from '@age/capability-kit';
import type { ExecutionId } from './execution-id';
import type { ExecutionScope } from './execution-target';
import type { ExecutionStatus, ExecutionMode, ExecutionRejectionReason } from '../enums';

/** The canonical AGE traceability chain (Doc 12 §8). */
export const TRACEABILITY_CHAIN =
  'Evidence → BIF → Decision → Capability Output → Execution' as const;

/**
 * ExecutionAuditRecord — pure, in-memory provenance for one execution outcome
 * (ADR-0021 §6). Every result — including blocked/rejected ones — yields a
 * record, so no execution decision is untraceable. Durable AuditLog persistence
 * (Doc 12 §8, Doc 13 §8) is a later, separately-decided slice.
 *
 * `decidedAt` is taken from the request's inputs (approval time when approved,
 * otherwise the origin item's createdAt) — never a wall-clock read — so records
 * are deterministic for the same input.
 */
export interface ExecutionAuditRecord {
  readonly executionId: ExecutionId;
  readonly capability: Capability;
  /** Origin: the accepted CapabilityOutputItem.id this execution derives from. */
  readonly sourceItemId: string;
  readonly executionDomain: ExecutionDomain;
  readonly scope: ExecutionScope;
  readonly status: ExecutionStatus;
  readonly mode: ExecutionMode;
  /** Always false in this slice — no side effect is ever performed. */
  readonly sideEffectsPerformed: false;
  /** Present only when the execution did not proceed to dry-run. */
  readonly rejectionReason?: ExecutionRejectionReason;
  readonly decidedAt: Date;
  readonly traceability: typeof TRACEABILITY_CHAIN;
}
