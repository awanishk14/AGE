import { describe, expect, it } from 'vitest';
import { ExecutionMode, ExecutionStatus, ExecutionRejectionReason } from '@age/execution-contracts';
import type { ApprovalContext } from '@age/execution-contracts';
import { runAllCapabilities } from '../capabilities';
import {
  buildExecutionPreviews,
  previewItemExecution,
  simulatedDemoApproval,
  DEMO_EXECUTION_DOMAINS,
} from '../execution-preview';

const unapproved: ApprovalContext = { approved: false };

describe('demo dry-run execution preview', () => {
  it('produces one preview per accepted decision object across all capabilities', async () => {
    const reports = await runAllCapabilities();
    const previews = buildExecutionPreviews(reports, simulatedDemoApproval());

    const acceptedTotal = reports.reduce((sum, r) => sum + r.acceptedItems.length, 0);
    expect(previews).toHaveLength(acceptedTotal);
    expect(acceptedTotal).toBeGreaterThan(0);
  });

  it('runs in dry-run mode only and never performs side effects', async () => {
    const reports = await runAllCapabilities();
    const previews = buildExecutionPreviews(reports, simulatedDemoApproval());

    for (const { result } of previews) {
      expect(result.mode).toBe(ExecutionMode.DRY_RUN);
      expect(result.sideEffectsPerformed).toBe(false);
      expect(result.status).toBe(ExecutionStatus.DRY_RUN_COMPLETED);
      expect(result.audit.sideEffectsPerformed).toBe(false);
      expect(result.audit.mode).toBe(ExecutionMode.DRY_RUN);
    }
  });

  it('requires an explicit simulated approval context — an unapproved preview is BLOCKED', async () => {
    const reports = await runAllCapabilities();
    const previews = buildExecutionPreviews(reports, unapproved);

    for (const { result } of previews) {
      expect(result.status).toBe(ExecutionStatus.BLOCKED);
      expect(result.rejectionReason).toBe(ExecutionRejectionReason.UNAPPROVED);
      expect(result.sideEffectsPerformed).toBe(false);
      // Blocked requests never reach the executor, so there is no plan.
      expect(result.plan).toBeUndefined();
    }
  });

  it('preserves traceability/provenance back to the accepted capability output', async () => {
    const reports = await runAllCapabilities();
    const previews = buildExecutionPreviews(reports, simulatedDemoApproval());

    for (const entry of previews) {
      const { result } = entry;
      expect(result.audit.traceability).toBe(
        'Evidence → BIF → Decision → Capability Output → Execution',
      );
      // Origin item id is carried through into the audit record.
      expect(result.audit.sourceItemId).toBe(entry.sourceItemId);
      expect(result.audit.executionDomain).toBe(entry.executionDomain);
    }
  });

  it('does not mutate the demo capability reports or their accepted items', async () => {
    const reports = await runAllCapabilities();
    const before = JSON.stringify(reports);

    buildExecutionPreviews(reports, simulatedDemoApproval());

    expect(JSON.stringify(reports)).toBe(before);
    // The origin fields the mapper reads are still intact on every item.
    for (const report of reports) {
      for (const item of report.acceptedItems) {
        expect(item.id).toBeTruthy();
        expect(item.capability).toBeTruthy();
        expect(item.createdAt).toBeInstanceOf(Date);
      }
    }
  });

  it('is deterministic across runs (input-derived, no wall-clock)', async () => {
    const view = (reports: Awaited<ReturnType<typeof runAllCapabilities>>) =>
      buildExecutionPreviews(reports, simulatedDemoApproval()).map((e) => ({
        capabilityName: e.capabilityName,
        sourceItemId: e.sourceItemId,
        executionDomain: e.executionDomain,
        status: e.result.status,
        executionId: e.result.executionId,
        decidedAt: e.result.audit.decidedAt.toISOString(),
      }));

    expect(view(await runAllCapabilities())).toEqual(view(await runAllCapabilities()));
  });

  it('targets a known ExecutionDomain for every accepted item via the demo map', async () => {
    const reports = await runAllCapabilities();
    for (const report of reports) {
      for (const item of report.acceptedItems) {
        expect(DEMO_EXECUTION_DOMAINS[item.capability]).toBeDefined();
      }
    }
  });

  it('previewItemExecution reads a single item without mutating it', async () => {
    const [firstReport] = await runAllCapabilities();
    const item = firstReport?.acceptedItems[0];
    expect(item).toBeDefined();
    if (!item) return;
    const snapshot = JSON.stringify(item);

    const result = previewItemExecution(item, simulatedDemoApproval());

    expect(JSON.stringify(item)).toBe(snapshot);
    expect(result.sideEffectsPerformed).toBe(false);
    expect(result.mode).toBe(ExecutionMode.DRY_RUN);
  });
});
