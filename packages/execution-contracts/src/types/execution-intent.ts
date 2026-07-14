import type { Capability } from '@age/capability-kit';

/**
 * ExecutionIntent — the pure, approved thing to be fulfilled (ADR-0021 §2, §5).
 *
 * The Execution Layer never authors intent (origin constraint, Doc 12 §4). An
 * intent is always derived from an already-accepted capability output and
 * carries that origin (`sourceItemId`, `capability`, `sourceCreatedAt`) so the
 * canonical traceability chain — Evidence → BIF → Decision → Capability Output →
 * Execution (Doc 12 §8) — is preserved.
 */
export interface ExecutionIntent {
  /** The capability whose accepted output produced this intent (why). */
  readonly capability: Capability;
  /** The accepted CapabilityOutputItem.id this intent originates from (origin). */
  readonly sourceItemId: string;
  /** The origin item's createdAt, preserved for provenance. */
  readonly sourceCreatedAt: Date;
  /** Human-readable description of what would be fulfilled. */
  readonly summary: string;
}
