import { Injectable } from '@nestjs/common';
import {
  runAllCapabilities,
  buildExecutionPreviews,
  simulatedDemoApproval,
  SIMULATED_DEMO_APPROVER,
  SIMULATED_DEMO_APPROVED_AT,
  type CapabilityRunReport,
  type ExecutionPreviewEntry,
} from '@age/demo-runtime';
import type {
  CapabilityDemoReport,
  CapabilityDemoResponse,
  ExecutionPreviewDto,
  ExecutionPreviewEntryDto,
} from './dto';

const DEMO_TITLE = 'AGE — In-Memory Capability Demo';
const DEMO_DESCRIPTION =
  'Runs the six completed AGE capabilities against local fixtures, in-memory, ' +
  'and returns human-reviewable decision objects. Read-only: nothing is ' +
  'persisted, dispatched, or executed.';

/**
 * Project one shared-runtime execution preview entry into the read-only API
 * DTO shape. Pure projection — reuses the dry-run result produced by
 * `@age/demo-runtime` (which itself delegates to `@age/execution-contracts`);
 * no execution logic is duplicated here.
 */
function toExecutionPreviewEntryDto(entry: ExecutionPreviewEntry): ExecutionPreviewEntryDto {
  return {
    capability: entry.capabilityName,
    sourceItemId: entry.sourceItemId,
    executionDomain: entry.executionDomain,
    status: entry.result.status,
    mode: entry.result.mode,
    sideEffectsPerformed: entry.result.sideEffectsPerformed,
    traceability: entry.result.audit.traceability,
    detail: entry.result.detail,
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
    const reports = await runAllCapabilities();
    const demoReports = reports.map(toDemoReport);

    const totalPendingApprovals = demoReports.reduce(
      (sum, report) => sum + report.pendingApproval.length,
      0,
    );
    const accountingInvariantHolds = reports.every((report) => report.accountingHolds);

    const previewEntries = buildExecutionPreviews(reports, simulatedDemoApproval());
    const executionPreview: ExecutionPreviewDto = {
      mode: 'dry_run',
      sideEffectsPerformed: false,
      humanApprovalRequired: true,
      simulatedApproval: {
        approvedBy: SIMULATED_DEMO_APPROVER,
        approvedAt: SIMULATED_DEMO_APPROVED_AT.toISOString(),
      },
      entries: previewEntries.map(toExecutionPreviewEntryDto),
    };

    return {
      title: DEMO_TITLE,
      description: DEMO_DESCRIPTION,
      humanApprovedExecution: true,
      sideEffectsPerformed: false,
      reports: demoReports,
      summary: {
        capabilitiesRun: reports.length,
        totalPendingApprovals,
        accountingInvariantHolds,
      },
      executionPreview,
    };
  }
}
