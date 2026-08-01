import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '@age/business-discovery-contracts';
import type { BusinessDiscoveryProfile } from '@age/business-discovery-contracts';

/**
 * DEMO_BUSINESS_DISCOVERY_PROFILE — the business the demo is about.
 *
 * ADR-0049 D1/D2 made the discovery profile a **required parameter** of the
 * intake stage rather than a constant read from inside it. This module is what
 * the demo call sites pass, and it exists for exactly the reason
 * `DEMO_SCENARIO_METADATA` does: the value must be **visible at the call site**,
 * not hidden inside the stage that consumes it.
 *
 * ⚠️ This is deliberately NOT a default parameter value. A default would
 * reinstate the precise coupling ADR-0049 removed — the intake would once again
 * work without being told whose business it is analysing, and "which business is
 * this?" would stop being a question the call site has to answer.
 *
 * ⚠️ It re-exports the shared sample rather than declaring a second fixture:
 * `SAMPLE_BUSINESS_DISCOVERY_PROFILE` is the pinned regression baseline behind
 * the 98/63 intake vs 12/17 BIF facts, and a divergent copy here would let those
 * drift apart silently. The alias exists so that `apps/demo` and `apps/api` name
 * the demo's profile without taking a direct dependency on the contracts
 * package.
 */
export const DEMO_BUSINESS_DISCOVERY_PROFILE: BusinessDiscoveryProfile =
  SAMPLE_BUSINESS_DISCOVERY_PROFILE;
