/**
 * @age/business-discovery-capture — the first sanctioned use-case boundary
 * joining canonical Path B production to scored BIF snapshot capture
 * (ADR-0040).
 *
 * WHY A NEW PACKAGE (ADR-0040 D2). `@age/business-discovery-contracts` cannot
 * host it: its purity guard forbids persistence imports by name, and the
 * snapshot-persistence package already depends on it, so hosting the use case
 * there would invert the direction and create a cycle.
 * `@age/scored-bif-snapshot-persistence` *could* host it — it already depends
 * on both packages needed — but that package is the durable adapter for
 * snapshots, and a module inside it that maps a discovery profile and scores a
 * BIF makes "persistence" mean two things. Cheap once, a layering violation by
 * the third use case.
 *
 * This package sits ABOVE both: it depends on them, and nothing depends on it.
 * No cycle, and neither existing package needed an edit.
 *
 * NOTHING IS WIRED TO IT (ADR-0040 D11). No API route, no Web page, no demo
 * call, no capability, no composition root. The first runtime caller needs a
 * real `ClientContext` and a real input source, and both are still absent —
 * that remains a separate decision.
 */

export { BusinessDiscoveryScoredBifCaptureOrchestrator } from './business-discovery-scored-bif-capture-orchestrator';
export type {
  BusinessDiscoveryCaptureMapping,
  BusinessDiscoveryCaptureRequest,
  BusinessDiscoveryCaptureResult,
  BusinessDiscoveryCaptureStatus,
  CaptureFailed,
  CaptureNotRequested,
  CaptureSucceeded,
  ProduceAndCaptureRequest,
  ProduceOnlyRequest,
} from './business-discovery-scored-bif-capture-orchestrator';
