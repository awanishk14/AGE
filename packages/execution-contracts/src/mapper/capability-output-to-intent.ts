import type { CapabilityOutputItem } from '@age/capability-kit';
import type { ExecutionIntent } from '../types/execution-intent';

/**
 * Map an already-accepted capability output item to an ExecutionIntent.
 *
 * This is the *only* sanctioned way to produce an intent, enforcing the origin
 * constraint (Doc 12 §4, ADR-0021 §5): the Execution Layer never authors
 * intent; it derives it from approved capability output. The item's identity,
 * capability, and createdAt are carried through so the traceability chain
 * (Evidence → BIF → Decision → Capability Output → Execution) is preserved.
 *
 * Pure: it reads the item and returns a new intent. It never mutates the item
 * and changes no capability logic.
 */
export function capabilityOutputItemToIntent(
  item: CapabilityOutputItem,
  summary?: string,
): ExecutionIntent {
  return {
    capability: item.capability,
    sourceItemId: item.id,
    sourceCreatedAt: item.createdAt,
    summary: summary ?? `Fulfill accepted ${item.capability} output ${item.id}`,
  };
}
