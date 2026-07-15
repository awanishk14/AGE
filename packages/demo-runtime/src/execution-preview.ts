import { Capability, ExecutionDomain, type CapabilityOutputItem } from '@age/capability-kit';
import {
  capabilityOutputItemToIntent,
  createExecutionRequest,
  runDryRunExecution,
  type ApprovalContext,
  type ExecutionResult,
  type ExecutionScope,
  type ExecutionTarget,
} from '@age/execution-contracts';

import { demoContext } from './fixtures/client-context';
import type { CapabilityRunReport } from './capabilities';

/**
 * Demo-only bridge from accepted capability outputs to a **dry-run execution
 * preview** (ADR-0021).
 *
 * This is NOT real execution and NOT Autonomous Execution. It takes the exact
 * same accepted decision objects the capability demo already produces, runs them
 * through the pure `@age/execution-contracts` foundation — mapper → guard →
 * dry-run/no-op executor — and returns auditable `ExecutionResult`s. Nothing is
 * mutated, nothing is persisted, no integration is called, and every result
 * carries `sideEffectsPerformed: false`. Human approval remains mandatory: the
 * caller must pass an explicit `ApprovalContext`; an unapproved context is
 * deterministically BLOCKED by the guard and never reaches the executor.
 */

/**
 * Deterministic, **demo-only** mapping of each business Capability to a single
 * ExecutionDomain, so the preview has a concrete `where` to target. This is a
 * presentation choice for the demo, not a product rule — real targeting is a
 * future, separately-decided slice.
 */
export const DEMO_EXECUTION_DOMAINS: Readonly<Record<Capability, ExecutionDomain>> = {
  [Capability.Intelligence]: ExecutionDomain.Reporting,
  [Capability.MarketDiscovery]: ExecutionDomain.SEO,
  [Capability.Growth]: ExecutionDomain.Content,
  [Capability.Authority]: ExecutionDomain.PR,
  [Capability.Operations]: ExecutionDomain.Automation,
  [Capability.Revenue]: ExecutionDomain.CRM,
  [Capability.Strategy]: ExecutionDomain.Reporting,
};

/**
 * A fixed, input-independent approval timestamp for the simulated demo approver,
 * so previews stay deterministic (no wall-clock read). It represents a human
 * having approved the item — the demo simulates the human, it does not remove
 * the requirement.
 */
export const SIMULATED_DEMO_APPROVED_AT = new Date('2026-07-14T00:00:00.000Z');

/** The simulated human approver identity used by the demo. */
export const SIMULATED_DEMO_APPROVER = 'demo-operator (simulated)';

/**
 * Build an explicit, simulated human-approval context for the demo. This is the
 * demo standing in for a real human approval; approval is still an explicit
 * input, never inferred by the execution layer.
 */
export function simulatedDemoApproval(
  approvedAt: Date = SIMULATED_DEMO_APPROVED_AT,
): ApprovalContext {
  return { approved: true, approvedBy: SIMULATED_DEMO_APPROVER, approvedAt };
}

/** One accepted decision object and the dry-run preview produced for it. */
export interface ExecutionPreviewEntry {
  readonly capabilityName: string;
  readonly sourceItemId: string;
  readonly executionDomain: ExecutionDomain;
  readonly result: ExecutionResult;
}

function demoScope(): ExecutionScope {
  return {
    organizationId: demoContext.organizationId,
    clientId: demoContext.clientId,
  };
}

/**
 * Produce a dry-run execution preview for a single accepted capability output
 * item. Pure: it reads the item, never mutates it, and performs no side effect.
 */
export function previewItemExecution(
  item: CapabilityOutputItem,
  approval: ApprovalContext,
): ExecutionResult {
  const intent = capabilityOutputItemToIntent(item);
  const target: ExecutionTarget = {
    executionDomain: DEMO_EXECUTION_DOMAINS[item.capability],
    scope: demoScope(),
  };
  const request = createExecutionRequest(intent, target, approval);
  return runDryRunExecution(request);
}

/**
 * Produce a dry-run execution preview for every accepted decision object across
 * all capability reports. Read-only: the reports and their items are never
 * mutated. `approval` must be supplied explicitly (use `simulatedDemoApproval()`
 * for the demo); pass an unapproved context to see the guard BLOCK it.
 */
export function buildExecutionPreviews(
  reports: readonly CapabilityRunReport[],
  approval: ApprovalContext,
): readonly ExecutionPreviewEntry[] {
  return reports.flatMap((report) =>
    report.acceptedItems.map((item) => ({
      capabilityName: report.name,
      sourceItemId: item.id,
      executionDomain: DEMO_EXECUTION_DOMAINS[item.capability],
      result: previewItemExecution(item, approval),
    })),
  );
}
