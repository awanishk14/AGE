import type {
  ScoredBifContext,
  ScoredBifSnapshotRepository,
} from '@age/business-discovery-contracts';
import type { ClientContext } from '@age/capability-kit';

import { ClientContextBoundScoredBifSnapshotRepository } from './client-context-bound-scored-bif-snapshot-repository';
import {
  ScoredBifSnapshotCapture,
  type ScoredBifSnapshotCaptureReceipt,
} from './scored-bif-snapshot-capture';

/**
 * The first caller of `ScoredBifSnapshotCapture` (ADR-0036 D1).
 *
 * WHY IT EXISTS, GIVEN THAT CAPTURE ALREADY EXISTS. The facade and the capture
 * service are bound to ONE `ClientContext` for their lifetime; the port is not.
 * So something has to hold the long-lived port and build the per-`ClientContext`
 * pair for the scope in hand. Left undecided, that something is every call site,
 * each holding the raw port — which is the exact shape ADR-0034 exists to stop.
 * Here it happens in one place, and "the raw port is only ever handed to the
 * facade constructor" becomes a property one test can assert.
 *
 * The second reason is failure. Both adapters THROW on a duplicate `snapshotId`,
 * so a caller that does not catch cannot tell a snapshot that failed to persist
 * from a programming error. This returns an outcome instead (ADR-0036 D8) — and
 * deliberately does not classify it, because the port defines no error taxonomy
 * and inferring one from message text would be a fiction dressed as a contract.
 *
 * WHAT IT IS NOT. It does not produce the `ScoredBifContext`: the mapper, the
 * scorer and `projectScoredBifContext` stay upstream and stay pure (D4, D6). It
 * does not capture as a side effect of anything (D5), does not invoke or depend
 * on capabilities (D7), reads no clock, mints no ids, and holds no ambient
 * scope — every call supplies its own `ClientContext` (D2, D3).
 */

/**
 * One capture request. Scope is supplied as a `ClientContext`, never as ids.
 *
 * The `?: never` members mirror the facade and the capture service for the same
 * reason: excess-property checking only catches an object literal, so a caller
 * assembling input in a variable first could otherwise slip a `clientId`
 * through, where it would be silently ignored.
 */
export interface OrchestratedScoredBifSnapshotCaptureInput {
  /** Authoritative scope for this capture (ADR-0009, ADR-0034 D1). Per call, never ambient. */
  readonly clientContext: ClientContext;
  /** Identity of this member of the series. Caller-supplied (ADR-0030 D4). */
  readonly snapshotId: string;
  /** Canonical ISO-8601 UTC capture instant. Caller-supplied for the same reason. */
  readonly capturedAt: string;
  /**
   * The already-produced projection. Never a `BusinessIntelligenceFramework`:
   * ADR-0035 D6 keeps `@age/bif` out of this package, and projection stays the
   * caller's step at the sanctioned boundary.
   */
  readonly context: ScoredBifContext;

  /** @deprecated Not a parameter. Scope comes from `clientContext` (ADR-0036 D9). */
  readonly clientId?: never;
  /** @deprecated Not a parameter. Scope comes from `clientContext` (ADR-0036 D9). */
  readonly organizationId?: never;
}

/** The snapshot was written. Carries the ADR-0035 receipt unchanged. */
export interface ScoredBifSnapshotCaptured {
  readonly status: 'captured';
  readonly receipt: ScoredBifSnapshotCaptureReceipt;
}

/**
 * The snapshot was not written.
 *
 * It carries the original `Error` rather than a message string so nothing is
 * lost, and it is deliberately not classified: distinguishing "already
 * captured" from "database unavailable" needs the port to say so, which is its
 * own decision (ADR-0036 D8 and its open questions).
 */
export interface ScoredBifSnapshotCaptureFailed {
  readonly status: 'failed';
  readonly error: Error;
}

export type ScoredBifSnapshotCaptureOutcome =
  ScoredBifSnapshotCaptured | ScoredBifSnapshotCaptureFailed;

export class ScoredBifSnapshotCaptureOrchestrator {
  private readonly snapshots: ScoredBifSnapshotRepository;

  constructor(snapshots: ScoredBifSnapshotRepository) {
    this.snapshots = snapshots;
  }

  /**
   * Binds the supplied `ClientContext` to the port, captures, and reports the
   * outcome.
   *
   * The port is used for exactly one thing — constructing the bound facade. No
   * composite key is assembled here, and no scope id is read from anywhere but
   * the `ClientContext` the caller passed in.
   */
  async capture(
    input: OrchestratedScoredBifSnapshotCaptureInput,
  ): Promise<ScoredBifSnapshotCaptureOutcome> {
    const capture = new ScoredBifSnapshotCapture(
      new ClientContextBoundScoredBifSnapshotRepository(input.clientContext, this.snapshots),
    );

    try {
      const receipt = await capture.capture({
        snapshotId: input.snapshotId,
        capturedAt: input.capturedAt,
        context: input.context,
      });

      return { status: 'captured', receipt };
    } catch (error: unknown) {
      return { status: 'failed', error: asError(error) };
    }
  }
}

/**
 * Anything can be thrown in JavaScript, and an outcome that promised an `Error`
 * has to hand back one. A non-`Error` throw is preserved in the message rather
 * than discarded.
 */
function asError(thrown: unknown): Error {
  return thrown instanceof Error ? thrown : new Error(`Capture failed: ${String(thrown)}`);
}
