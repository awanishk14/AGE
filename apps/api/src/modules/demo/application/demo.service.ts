import { Injectable } from '@nestjs/common';
import {
  DEMO_SCENARIO_METADATA,
  runAllCapabilities,
  runBusinessDiscoveryIntake,
  type BusinessDiscoveryIntakeSummary,
  type CapabilityRunReport,
} from '@age/demo-runtime';
import type {
  BusinessDiscoveryDemoSummary,
  CapabilityDemoReport,
  CapabilityDemoResponse,
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
    const discovery = runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
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
      reports: demoReports,
      summary: {
        capabilitiesRun: reports.length,
        totalPendingApprovals,
        accountingInvariantHolds,
      },
    };
  }
}
