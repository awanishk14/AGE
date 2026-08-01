import { Injectable } from '@nestjs/common';
import {
  DEMO_BUSINESS_DISCOVERY_PROFILE,
  DEMO_SCENARIO_METADATA,
  buildContextReadinessReport,
  produceDemoScoredBifContext,
  runAllCapabilities,
  runBusinessDiscoveryIntake,
  type BusinessDiscoveryIntakeSummary,
  type CapabilityRunReport,
  type ContextReadinessEntry,
  type ContextReadinessReport,
} from '@age/demo-runtime';
import type {
  BusinessDiscoveryDemoSummary,
  CapabilityDemoReport,
  CapabilityDemoResponse,
  ContextReadinessDemoEntry,
  ContextReadinessDemoReport,
} from './dto';

const DEMO_TITLE = 'AGE — In-Memory Capability Demo';
const DEMO_DESCRIPTION =
  'Runs the upstream Business Discovery intake and the six completed AGE ' +
  'capabilities against local fixtures, in-memory, and returns human-reviewable ' +
  'decision objects plus the intake context that precedes them. Read-only: ' +
  'nothing is persisted, dispatched, or executed, and no BIF is promoted.';

/**
 * Project the shared runtime's intake summary into the API shape.
 *
 * Field-by-field rather than a spread, deliberately: the runtime summary is
 * free to grow fields that the read-only endpoint has not decided to expose,
 * and a spread would publish them silently.
 */
function toBusinessDiscoverySummary(
  summary: BusinessDiscoveryIntakeSummary,
): BusinessDiscoveryDemoSummary {
  return {
    profileId: summary.profileId,
    businessName: summary.businessName,
    questionnaireId: summary.questionnaireId,
    questionnaireVersion: summary.questionnaireVersion,
    profileSchemaValid: summary.profileSchemaValid,
    questionnaireValid: summary.questionnaireValid,
    missingRequiredCount: summary.missingRequiredCount,
    criticalGapCount: summary.criticalGapCount,
    discoveryCompletenessScore: summary.discoveryCompletenessScore,
    discoveryConfidenceScore: summary.discoveryConfidenceScore,
    bifCompletenessScore: summary.bifCompletenessScore,
    bifConfidenceScore: summary.bifConfidenceScore,
    bifStatus: summary.bifStatus,
    presentSectionTypes: summary.presentSectionTypes,
    omittedSectionTypes: summary.omittedSectionTypes,
    evidenceReferenceCount: summary.evidenceReferenceCount,
    assumptionCount: summary.assumptionCount,
    goalCount: summary.goalCount,
    offeringCount: summary.offeringCount,
    customerSegmentCount: summary.customerSegmentCount,
    competitorCount: summary.competitorCount,
  };
}

/**
 * Project one readiness row into the API shape, field by field.
 *
 * ⚠️ A spread is refused here for the same reason it is refused for the intake
 * block: the runtime row is free to grow a field the read-only endpoint has not
 * decided to publish, and a spread would publish it silently.
 *
 * ⚠️ Optional fields are copied as-is. An absent field stays absent — it is
 * never coerced to `null`, `0`, `[]` or `"N/A"`, because a non-adopter has no
 * honest value to report and a filled-in one would read as a deficiency
 * (ADR-0047 D5).
 */
function toReadinessEntry(entry: ContextReadinessEntry): ContextReadinessDemoEntry {
  return {
    capabilityName: entry.capabilityName,
    assessesContext: entry.assessesContext,
    declaration: entry.declaration,
    state: entry.state,
    reasons: entry.reasons,
    limitations: entry.limitations,
    improvementHints: entry.improvementHints,
    requiredSectionTypes: entry.requiredSectionTypes,
    // Each capability's OWN published thresholds, carried through unchanged.
    // Never merged with another capability's, never compared against one.
    thresholds: entry.thresholds,
    denominator: entry.denominator,
  };
}

/**
 * Project the readiness stage for the API.
 *
 * ⚠️ `entries` keeps the runtime's fixed registry order. It is never sorted,
 * grouped or ordered by state, and NO aggregate is derived from it — an
 * "overall readiness", a count of ready capabilities, or any ordering by state
 * would express three incommensurable measurements on one invented scale
 * (ADR-0047 D4 / ADR-0048 D7).
 */
function toReadinessReport(report: ContextReadinessReport): ContextReadinessDemoReport {
  return {
    incommensurabilityNotice: report.incommensurabilityNotice,
    entries: report.entries.map(toReadinessEntry),
  };
}

/** Project one shared-runtime report into the read-only API report shape. */
function toDemoReport(report: CapabilityRunReport): CapabilityDemoReport {
  return {
    capability: report.name,
    acceptedCount: report.acceptedCount,
    rejectedCount: report.rejectedCount,
    duplicateCount: report.duplicateCount,
    derivedCount: report.derivedCount,
    inputItemCount: report.inputItemCount,
    accountingHolds: report.accountingHolds,
    acceptedItems: report.acceptedItems,
    rejectedReasons: report.rejectedReasons,
    duplicateReferences: report.duplicateReferences,
    pendingApproval: report.acceptedItems.map((item) => ({
      capability: report.name,
      id: item.id,
    })),
    extra: report.extra,
  };
}

/**
 * DemoService — application service that wraps the shared `@age/demo-runtime`.
 *
 * Strictly read-only and side-effect-free: it runs the pure capabilities in
 * memory and shapes their decision reports for the API. No persistence, queues,
 * events, integrations, external APIs, AI/LLM, or execution behaviour.
 */
@Injectable()
export class DemoService {
  async getCapabilityDemo(): Promise<CapabilityDemoResponse> {
    // The scenario metadata is passed explicitly (ADR-0039 D3): the three values
    // canonical Path B mapping needs are visible at the call site. It is demo
    // scenario framing only — never production tenant identity, never scope.
    const discovery = runBusinessDiscoveryIntake(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    );

    // Stage two: context readiness (ADR-0047 D1, published here by ADR-0048 D3
    // step 4). Produced through the demo's single production point (D2).
    // ⚠️ `producedAt` is supplied HERE from the frozen scenario time — never
    // `new Date()`, which would make this endpoint's response non-deterministic
    // and the CLI's determinism note false. `Object.freeze` is shallow, so the
    // Date is copied rather than handed out.
    const scoredBifContext = produceDemoScoredBifContext(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    ).context;
    const readiness = buildContextReadinessReport(scoredBifContext, {
      producedAt: new Date(DEMO_SCENARIO_METADATA.constructedAt.getTime()),
    });

    // ⚠️ The runs below take NO argument derived from readiness and must never
    // become gated on it (ADR-0047 D7b). Readiness is reported beside them.
    const reports = await runAllCapabilities();
    const demoReports = reports.map(toDemoReport);

    const totalPendingApprovals = demoReports.reduce(
      (sum, report) => sum + report.pendingApproval.length,
      0,
    );
    const accountingInvariantHolds = reports.every((report) => report.accountingHolds);

    return {
      title: DEMO_TITLE,
      description: DEMO_DESCRIPTION,
      humanApprovedExecution: true,
      sideEffectsPerformed: false,
      businessDiscovery: toBusinessDiscoverySummary(discovery),
      contextReadiness: toReadinessReport(readiness),
      reports: demoReports,
      summary: {
        capabilitiesRun: reports.length,
        totalPendingApprovals,
        accountingInvariantHolds,
      },
    };
  }
}
