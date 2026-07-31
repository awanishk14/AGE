import type { ContextReadinessThresholds } from '@age/demo-runtime';

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

/**
 * One capability's context-readiness row, projected for the API.
 *
 * ⚠️ `thresholds` is each capability's OWN published threshold object, carried
 * through by reference to the capability's own constant. Its type is the
 * runtime's UNION of the three published threshold types — deliberately not
 * flattened to a `Record<string, number>`, which would suggest the three are
 * one shared scale. A row's state means nothing without the denominator
 * reported beside it (ADR-0047 D4).
 *
 * ⚠️ For a non-adopter, `state`, `reasons`, `thresholds` and
 * `requiredSectionTypes` are absent — never `null`, never `0`, never `"N/A"`,
 * and never a defaulted `sufficiency` (ADR-0047 D5). Non-adoption is a declared
 * property of the capability, not a deficiency, and inventing a value here
 * would publish it as one.
 */
export interface ContextReadinessDemoEntry {
  readonly capabilityName: string;
  /** Absent means the capability assesses no external context. */
  readonly assessesContext?: readonly string[];
  /** A plain sentence naming what this row is. Never a ranking or a verdict. */
  readonly declaration: string;
  /** The sufficiency state verbatim from the assessor. Adopters only. */
  readonly state?: string;
  readonly reasons?: readonly string[];
  readonly limitations?: readonly string[];
  /** What context would raise readiness — never what to conclude. */
  readonly improvementHints?: readonly string[];
  /** This capability's OWN denominator. */
  readonly requiredSectionTypes?: readonly string[];
  /** This capability's OWN published thresholds. Never a shared scale. */
  readonly thresholds?: ContextReadinessThresholds;
  /** States the denominator in words, so the row is readable without the ADRs. */
  readonly denominator?: string;
}

/**
 * The context-readiness stage, projected for the API (ADR-0048 D3 step 4).
 *
 * ⚠️ There is deliberately NO aggregate here — no "overall readiness", no count
 * of how many capabilities are ready, no ordering by state. The three published
 * states differ in DENOMINATOR, not merely in where a line was drawn, so any
 * value computed across them would invent a scale that does not exist
 * (ADR-0047 D4 / ADR-0048 D7). `entries` is in fixed registry order — the same
 * six names, in the same order, as `reports`. Never sort or group it.
 *
 * ⚠️ `incommensurabilityNotice` travels ON the payload, not as documentation a
 * consumer may skip: without it, three states in one list read as a scale.
 *
 * ⚠️ No scope identifier appears anywhere in this block (ADR-0048 D2) — this
 * endpoint is unauthenticated, and the readiness rows carry none by shape.
 */
export interface ContextReadinessDemoReport {
  readonly incommensurabilityNotice: readonly string[];
  readonly entries: readonly ContextReadinessDemoEntry[];
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
  /**
   * Stage two of the demo pipeline: intake → context readiness → capability
   * runs. ⚠️ The runs below are NOT gated on this block and must never become
   * so (ADR-0047 D7b); it is reported beside them, never above them.
   */
  readonly contextReadiness: ContextReadinessDemoReport;
  readonly reports: readonly CapabilityDemoReport[];
  readonly summary: {
    readonly capabilitiesRun: number;
    readonly totalPendingApprovals: number;
    readonly accountingInvariantHolds: boolean;
  };
}
