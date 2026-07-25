import type { ScoredBifContext } from '@age/business-discovery-contracts';

import type { ClientContextBoundScoredBifSnapshotRepository } from './client-context-bound-scored-bif-snapshot-repository';

/**
 * The first real package-level caller of `ClientContext`-bound scored BIF
 * snapshot access (ADR-0035 D1).
 *
 * WHAT IT IS FOR, STATED HONESTLY. It adds no validation the port lacks — both
 * adapters already call `normalizeScoredBifSnapshotRecord` on append, so
 * `capturedAt` format and payload JSON-safety are enforced beneath the facade.
 * What it contributes is a NAME and a RECEIPT:
 *
 * - a name, because "application code must not construct scoped snapshot keys"
 *   needs somewhere for application code to go instead, and a type called
 *   `…Repository` invites callers to think in rows rather than in the event
 *   that actually happened;
 * - a receipt, because the facade's `append` returns `void`, so a caller that
 *   has just captured a snapshot otherwise holds no handle on the identity it
 *   created without re-deriving it from its own inputs.
 *
 * IT IS INERT. No clock, no randomness, no id generation (ADR-0035 D4). It
 * cannot see a `clientId` or an `organizationId` — there is no parameter for
 * one, and it never consults the payload for scope (D3, D9). It writes through
 * the bound facade and through nothing else (D8), and it does not read (D10).
 */

/**
 * What a caller may supply for one capture. Scope is deliberately absent — it
 * comes from the `ClientContext` the injected facade was bound to.
 *
 * The two `?: never` members mirror `AppendScoredBifSnapshotInput` for the same
 * reason: excess-property checking only catches an object literal, so a caller
 * assembling input in a variable first could otherwise slip a `clientId`
 * through, where it would be silently ignored. Silently ignored is the failure
 * mode this whole track exists to remove.
 */
export interface CaptureScoredBifSnapshotInput {
  /** Identity of this member of the series. Caller-supplied (ADR-0030 D4). */
  readonly snapshotId: string;
  /** Canonical ISO-8601 UTC capture instant. Caller-supplied for the same reason. */
  readonly capturedAt: string;
  /**
   * The projected scored BIF context — the sanctioned neutral scored-context
   * boundary (ADR-0026 D1), never a live `BusinessIntelligenceFramework`
   * (ADR-0035 D6).
   *
   * It carries `bifId`, the subject of the snapshot, and
   * `metadata.scoringVersion`, which the row projection reads directly. Neither
   * is accepted as a separate parameter: a value the payload already carries
   * must not get a second, contradictable source.
   *
   * It carries NO client or organization id, and must never grow one.
   */
  readonly context: ScoredBifContext;

  /** @deprecated Not a parameter. Scope comes from `ClientContext` (ADR-0035 D3). */
  readonly clientId?: never;
  /** @deprecated Not a parameter. Scope comes from `ClientContext` (ADR-0035 D3). */
  readonly organizationId?: never;
}

/**
 * What was written, assembled from the inputs that were written — never read
 * back, never invented.
 *
 * It deliberately omits the scope ids. The caller already holds the
 * `ClientContext` they came from, and echoing them back would make the scope
 * look like something the write produced rather than something the caller was
 * already bound to.
 */
export interface ScoredBifSnapshotCaptureReceipt {
  readonly bifId: string;
  readonly snapshotId: string;
  readonly capturedAt: string;
}

export class ScoredBifSnapshotCapture {
  private readonly snapshots: ClientContextBoundScoredBifSnapshotRepository;

  constructor(snapshots: ClientContextBoundScoredBifSnapshotRepository) {
    this.snapshots = snapshots;
  }

  /**
   * Records that a scored BIF context was captured at a caller-supplied
   * instant, inside the scope the injected facade is bound to.
   *
   * Everything scope-related happens below this method, in the facade. Nothing
   * here reads, derives or defaults a `clientId` or an `organizationId`.
   */
  async capture(input: CaptureScoredBifSnapshotInput): Promise<ScoredBifSnapshotCaptureReceipt> {
    await this.snapshots.append({
      snapshotId: input.snapshotId,
      capturedAt: input.capturedAt,
      context: input.context,
    });

    return {
      bifId: input.context.bifId,
      snapshotId: input.snapshotId,
      capturedAt: input.capturedAt,
    };
  }
}
