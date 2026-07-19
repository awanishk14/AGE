/**
 * Response shape for `GET /demo/capabilities`.
 *
 * Plain, serializable data — a read-only projection of the shared demo runtime's
 * decision reports. No execution result is ever included: every accepted item is
 * a recommendation pending human approval.
 */

/** One approval-pending decision object, flattened for the API consumer. */
export interface PendingApprovalRef {
  readonly capability: string;
  readonly id: string;
}

/** Per-capability report as returned by the endpoint. */
export interface CapabilityDemoReport {
  readonly capability: string;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly duplicateCount: number;
  /** accepted + rejected + duplicate. */
  readonly derivedCount: number;
  readonly inputItemCount: number;
  /** True when derivedCount === inputItemCount (no silent disappearance). */
  readonly accountingHolds: boolean;
  readonly acceptedItems: readonly unknown[];
  readonly rejectedReasons: readonly unknown[];
  readonly duplicateReferences: readonly unknown[];
  readonly pendingApproval: readonly PendingApprovalRef[];
  readonly extra?: Readonly<Record<string, number>>;
}

/** Top-level response envelope for the capability demo endpoint. */
export interface CapabilityDemoResponse {
  readonly title: string;
  readonly description: string;
  /** AGE runs under Human-Approved Execution — always true for this demo. */
  readonly humanApprovedExecution: true;
  /** This endpoint is read-only and side-effect-free — always false. */
  readonly sideEffectsPerformed: false;
  readonly reports: readonly CapabilityDemoReport[];
  readonly summary: {
    readonly capabilitiesRun: number;
    readonly totalPendingApprovals: number;
    readonly accountingInvariantHolds: boolean;
  };
}
