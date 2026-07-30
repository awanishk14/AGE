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
 * The upstream Business Discovery intake stage, projected for the API.
 *
 * Discovery is NOT a capability: it produces no decision objects, nothing here
 * is ever approved or executed, and it carries no `pendingApproval`. It is
 * reported as context.
 *
 * The four scores are two distinct pairs and must never be conflated: the
 * `discovery*` pair describes the *interview*, the `bif*` pair describes the
 * produced Draft BIF. They are read from the mapper, never recomputed here.
 */
export interface BusinessDiscoveryDemoSummary {
  readonly profileId: string;
  readonly businessName: string;
  readonly questionnaireId: string;
  readonly questionnaireVersion: string;
  readonly profileSchemaValid: boolean;
  readonly questionnaireValid: boolean;
  readonly missingRequiredCount: number;
  readonly criticalGapCount: number;
  /** Intake capture completeness. Never `bifCompletenessScore`. */
  readonly discoveryCompletenessScore: number;
  /** Discovery input confidence. Never `bifConfidenceScore`. */
  readonly discoveryConfidenceScore: number;
  /** BIF population completeness. Never `discoveryCompletenessScore`. */
  readonly bifCompletenessScore: number;
  /** Trust in the produced business intelligence. */
  readonly bifConfidenceScore: number;
  /** Always `Draft` — this endpoint never promotes a BIF. */
  readonly bifStatus: string;
  /** Canonical BIF sections the mapping populated, in projection order. */
  readonly presentSectionTypes: readonly string[];
  /** Canonical sections discovery could not populate — limitations, never evidence. */
  readonly omittedSectionTypes: readonly string[];
  readonly evidenceReferenceCount: number;
  readonly assumptionCount: number;
  readonly goalCount: number;
  readonly offeringCount: number;
  readonly customerSegmentCount: number;
  readonly competitorCount: number;
}

/** Top-level response envelope for the capability demo endpoint. */
export interface CapabilityDemoResponse {
  readonly title: string;
  readonly description: string;
  /** AGE runs under Human-Approved Execution — always true for this demo. */
  readonly humanApprovedExecution: true;
  /** This endpoint is read-only and side-effect-free — always false. */
  readonly sideEffectsPerformed: false;
  /** Upstream intake context. Never a capability, never pending approval. */
  readonly businessDiscovery: BusinessDiscoveryDemoSummary;
  readonly reports: readonly CapabilityDemoReport[];
  readonly summary: {
    readonly capabilitiesRun: number;
    readonly totalPendingApprovals: number;
    readonly accountingInvariantHolds: boolean;
  };
}
