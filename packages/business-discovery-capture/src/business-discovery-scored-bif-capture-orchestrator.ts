import type {
  BifConfidenceScoringMetadata,
  BusinessDiscoveryBifMetadata,
  BusinessDiscoveryProfile,
  ProduceScoredBifContextOptions,
  ScoredBifContext,
} from '@age/business-discovery-contracts';
import { produceScoredBifContext } from '@age/business-discovery-contracts';
import type { ClientContext } from '@age/capability-kit';
import type {
  ScoredBifSnapshotCaptureOrchestrator,
  ScoredBifSnapshotCaptureReceipt,
} from '@age/scored-bif-snapshot-persistence';

/**
 * The first sanctioned use case joining the produce side to the capture side
 * (ADR-0040 D1).
 *
 * WHY IT EXISTS. Every piece was already built and none of them met.
 * `produceScoredBifContext` ends at a `ScoredBifContext` in memory;
 * `ScoredBifSnapshotCaptureOrchestrator` begins at one it is handed. Until now
 * the two halves met only inside tests. That gap was deliberate — ADR-0036
 * D4/D6 kept production out of the capture orchestrator and ADR-0037 D7 kept
 * persistence out of the produce chain — so the join had to be an explicit,
 * named, reviewable decision rather than an import someone added.
 *
 * WHAT IT IS. A use case. Not a mapper, not a persistence adapter, not an app
 * endpoint, not a capability. It composes; it does not implement either half.
 * It never touches `ScoredBifSnapshotRepository`, the bound facade, or Prisma —
 * it takes the ADR-0036 orchestrator, which stays the only thing that
 * constructs the bound facade.
 *
 * WHAT IT DOES NOT DO. It reads no clock, mints no ids, uses no randomness, and
 * holds no ambient scope. It never promotes the BIF. It does not validate the
 * profile — `produceScoredBifContext` throws on invalid input at the mapper's
 * own guard, and swallowing that here would turn a caller error into a degraded
 * result (D10). Only the capture step, the one with an external cause, becomes
 * an outcome.
 */

/** Values the mapper needs that the caller must state explicitly (ADR-0040 D5). */
export interface BusinessDiscoveryCaptureMapping extends Omit<
  ProduceScoredBifContextOptions,
  'organizationId'
> {
  /**
   * @deprecated Not a parameter. The organization comes from `clientContext`
   * (ADR-0040 D6).
   *
   * `produceScoredBifContext` needs an `organizationId` for the BIF it builds,
   * and `ClientContext` carries an authoritative one for scope. Two sources for
   * one concept is how they silently disagree, so this use case accepts only
   * the authoritative one and flows it into the mapper. ADR-0030 forbids
   * reading scope FROM the payload; this is the permitted direction.
   */
  readonly organizationId?: never;
}

/** Produce a scored BIF context and stop. Persistence is not consulted at all. */
export interface ProduceOnlyRequest {
  readonly mode: 'produceOnly';
  /** Authoritative scope (ADR-0009, ADR-0040 D4). Per call, never ambient. */
  readonly clientContext: ClientContext;
  readonly profile: BusinessDiscoveryProfile;
  readonly mapping: BusinessDiscoveryCaptureMapping;

  /** @deprecated Not a parameter. Scope comes from `clientContext` (ADR-0040 D4). */
  readonly clientId?: never;
  /** @deprecated Not a parameter. Scope comes from `clientContext` (ADR-0040 D4). */
  readonly organizationId?: never;
}

/** Produce a scored BIF context, then capture it exactly once. */
export interface ProduceAndCaptureRequest {
  readonly mode: 'produceAndCapture';
  /** Authoritative scope (ADR-0009, ADR-0040 D4). Per call, never ambient. */
  readonly clientContext: ClientContext;
  readonly profile: BusinessDiscoveryProfile;
  readonly mapping: BusinessDiscoveryCaptureMapping;
  /** Identity of this member of the series. Caller-supplied (ADR-0030 D4). */
  readonly snapshotId: string;
  /** Canonical ISO-8601 UTC capture instant. Caller-supplied for the same reason. */
  readonly capturedAt: string;

  /** @deprecated Not a parameter. Scope comes from `clientContext` (ADR-0040 D4). */
  readonly clientId?: never;
  /** @deprecated Not a parameter. Scope comes from `clientContext` (ADR-0040 D4). */
  readonly organizationId?: never;
}

/**
 * Two explicit modes, never a default that writes (ADR-0040 D7). A caller who
 * forgets a flag gets no write, not a surprise one.
 */
export type BusinessDiscoveryCaptureRequest = ProduceOnlyRequest | ProduceAndCaptureRequest;

/** Capture was not asked for, so nothing was attempted. */
export interface CaptureNotRequested {
  readonly kind: 'not-requested';
}

/** The snapshot was written. Carries the ADR-0035 receipt unchanged. */
export interface CaptureSucceeded {
  readonly kind: 'captured';
  readonly receipt: ScoredBifSnapshotCaptureReceipt;
}

/**
 * The snapshot was not written.
 *
 * Deliberately unclassified, for the reason ADR-0036 D8 gave: the port defines
 * no error taxonomy, and inferring "already captured" from message text would
 * be a fiction dressed as a contract.
 */
export interface CaptureFailed {
  readonly kind: 'failed';
  readonly error: Error;
}

export type BusinessDiscoveryCaptureStatus = CaptureNotRequested | CaptureSucceeded | CaptureFailed;

/**
 * The produced context, plus what happened to it.
 *
 * The context is returned even when capture fails (ADR-0040 D9): it was
 * genuinely produced by pure code, and discarding correct work because a write
 * failed would tell the caller less. The failure is not swallowed either — it
 * is a state the caller must narrow past to reach a receipt.
 */
export interface BusinessDiscoveryCaptureResult {
  readonly context: ScoredBifContext;
  readonly mappingMetadata: BusinessDiscoveryBifMetadata;
  readonly scoringMetadata: BifConfidenceScoringMetadata;
  readonly capture: BusinessDiscoveryCaptureStatus;
}

export class BusinessDiscoveryScoredBifCaptureOrchestrator {
  private readonly captureOrchestrator?: ScoredBifSnapshotCaptureOrchestrator;

  /**
   * The capture dependency is optional ONLY because `produceOnly` genuinely
   * does not need it (ADR-0040 D8). Requesting capture without it is a
   * programming error, not a capture failure — see `execute`.
   */
  constructor(captureOrchestrator?: ScoredBifSnapshotCaptureOrchestrator) {
    if (captureOrchestrator !== undefined) {
      this.captureOrchestrator = captureOrchestrator;
    }
  }

  async execute(request: BusinessDiscoveryCaptureRequest): Promise<BusinessDiscoveryCaptureResult> {
    const { organizationId: _rejected, ...mapping } = request.mapping;

    const { context, mappingMetadata, scoringMetadata } = produceScoredBifContext(request.profile, {
      ...mapping,
      // The single authoritative source, flowing into the payload it describes.
      organizationId: request.clientContext.organizationId,
    });

    if (request.mode === 'produceOnly') {
      return { context, mappingMetadata, scoringMetadata, capture: { kind: 'not-requested' } };
    }

    const captureOrchestrator = this.captureOrchestrator;

    if (captureOrchestrator === undefined) {
      // THROWS rather than reporting a failure: nothing was attempted, and
      // calling that "failed" would let a misconfiguration masquerade as a
      // database problem (ADR-0040 D8).
      throw new Error(
        'Capture was requested but no ScoredBifSnapshotCaptureOrchestrator was injected.',
      );
    }

    const outcome = await captureOrchestrator.capture({
      clientContext: request.clientContext,
      snapshotId: request.snapshotId,
      capturedAt: request.capturedAt,
      context,
    });

    return {
      context,
      mappingMetadata,
      scoringMetadata,
      capture:
        outcome.status === 'captured'
          ? { kind: 'captured', receipt: outcome.receipt }
          : { kind: 'failed', error: outcome.error },
    };
  }
}
