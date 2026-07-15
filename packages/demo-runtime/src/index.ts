/**
 * @age/demo-runtime — the pure, in-memory AGE capability demo.
 *
 * Runs the six completed capabilities against local fixtures and returns
 * uniform, human-reviewable decision reports. Strictly Human-Approved
 * Execution: no persistence, queues/events, integrations, HTTP, filesystem
 * writes, external APIs, AI/LLM, or execution engines. Nothing here performs a
 * real side effect — every output is a recommendation awaiting human approval.
 *
 * Consumed by both `apps/demo` (CLI) and `apps/api` (read-only endpoint) so the
 * runner logic and fixtures live in exactly one place.
 */
export { runAllCapabilities, type CapabilityRunReport } from './capabilities';
export {
  DEMO_EXECUTION_DOMAINS,
  SIMULATED_DEMO_APPROVED_AT,
  SIMULATED_DEMO_APPROVER,
  simulatedDemoApproval,
  previewItemExecution,
  buildExecutionPreviews,
  type ExecutionPreviewEntry,
} from './execution-preview';
export * from './fixtures';
