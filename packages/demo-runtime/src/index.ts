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
// The demo's single point of ScoredBifContext production (ADR-0047 D2). Both
// the intake stage and the context-readiness stage produce through this.
export { produceDemoScoredBifContext } from './scored-bif-context';
// Context readiness — the demo's THIRD stage (ADR-0047 D1):
// intake → context readiness → capability runs. First non-test caller of the
// ADR-0027 readiness pattern. ⚠️ Never gates `run`; never ranks; no aggregate.
export {
  buildContextReadinessReport,
  type ContextReadinessReport,
  type ContextReadinessEntry,
  type ContextReadinessThresholds,
  type BuildContextReadinessReportOptions,
} from './context-readiness';
// Demo scenario metadata (ADR-0039). The demo's own declared organizationId /
// constructedAt / changedBy for canonical Path B mapping. Scenario framing only
// — never production tenant identity, never scope.
export { DEMO_SCENARIO_METADATA, type DemoScenarioMetadata } from './demo-scenario-metadata';
export * from './fixtures';
