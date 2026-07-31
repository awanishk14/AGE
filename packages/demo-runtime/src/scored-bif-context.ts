import {
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  produceScoredBifContext,
} from '@age/business-discovery-contracts';

import type { DemoScenarioMetadata } from './demo-scenario-metadata';

/**
 * The demo's single point of `ScoredBifContext` production (ADR-0047 D2).
 *
 * Both demo stages that need a scored context — the Business Discovery intake
 * summary and the context-readiness bridge — call THIS function. The three
 * caller-supplied values canonical Path B requires (`organizationId`,
 * `constructedAt`, `changedBy`) are therefore assembled in exactly one place.
 *
 * WHY THIS EXISTS RATHER THAN A `context` FIELD ON THE INTAKE SUMMARY:
 * `BusinessDiscoveryIntakeSummary` is the four-score contract that pins
 * 97/63 intake vs 12/17 BIF across three surfaces, and it is projected
 * field-by-field into a published API DTO. Widening it to carry the context
 * would drag this slice into the API layer for no benefit (ADR-0047 D2).
 *
 * ⚠️ A second call is pure and returns an equal result — `produceScoredBifContext`
 * reads no clock and mutates nothing. What D2 forbids is not a second call but a
 * second *hand-assembly* of the scenario values, which is the failure
 * `produceScoredBifContext` exists to prevent. Callers may call this freely.
 *
 * ⚠️ `Object.freeze` on `DEMO_SCENARIO_METADATA` is SHALLOW, so its `Date` is
 * mutable. A copy is passed, never the caller's reference (ADR-0047 D3).
 */
export function produceDemoScoredBifContext(scenario: DemoScenarioMetadata) {
  return produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
    organizationId: scenario.organizationId,
    constructedAt: new Date(scenario.constructedAt.getTime()),
    changedBy: scenario.changedBy,
  });
}
