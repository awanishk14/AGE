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
  runBusinessDiscoveryIntake,
  type BusinessDiscoveryIntakeSummary,
} from './business-discovery';
export * from './fixtures';
