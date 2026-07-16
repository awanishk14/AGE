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

/**
 * One accepted decision object's dry-run execution preview, flattened for the
 * API consumer. This is NOT a real execution result — `sideEffectsPerformed`
 * is always `false` and the item is still pending human approval; the preview
 * only shows what a (future, separately-decided) real execution would look
 * like.
 */
export interface ExecutionPreviewEntryDto {
  readonly capability: string;
  readonly sourceItemId: string;
  readonly executionDomain: string;
  readonly status: string;
  readonly mode: string;
  /** Invariant: this slice never performs a real side effect. */
  readonly sideEffectsPerformed: false;
  readonly traceability: string;
  readonly detail?: string;
}

/**
 * Read-only, dry-run-only execution preview (Phase 5 Slices 1–2, ADR-0021).
 * NOT real execution and NOT Autonomous Execution: every entry is produced by
 * the pure `@age/execution-contracts` dry-run executor via
 * `@age/demo-runtime`, using a simulated (not real) human approval context.
 * Human approval remains mandatory before any real execution could occur.
 */
export interface ExecutionPreviewDto {
  /** Always 'dry_run' in this slice. */
  readonly mode: 'dry_run';
  /** Invariant across every entry: nothing real ever happens. */
  readonly sideEffectsPerformed: false;
  /** Always true — a real execution still requires genuine human approval. */
  readonly humanApprovalRequired: true;
  /** The demo's simulated (not real) approval context used to build this preview. */
  readonly simulatedApproval: {
    readonly approvedBy: string;
    readonly approvedAt: string;
  };
  readonly entries: readonly ExecutionPreviewEntryDto[];
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
  /** Read-only, dry-run-only execution preview. Never a real execution result. */
  readonly executionPreview: ExecutionPreviewDto;
}
