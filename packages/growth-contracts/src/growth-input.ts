import type { ExecutionDomain } from '@age/capability-kit';
import type { GrowthPlanType } from './enums';
import type { MarketOpportunityReference } from './market-opportunity-reference';

/**
 * GrowthPlanningInputItem — a single neutral, read-only planning input the
 * Growth Capability reasons over (ADR-0014). Derived upstream; Growth does not
 * collect it. Data contract only — no behavior.
 *
 * `planType` is caller-provided (ADR-0015 field proposal): the same opportunity
 * can legitimately support different plan types depending on caller intent, so
 * Growth carries planType rather than deriving it. `expectedImpact`,
 * `confidence`, and `estimatedEffort` are the ONLY fields scoring may read — all
 * scoring inputs are explicit here (no channel/source-tier weighting).
 * `executionDomains` are opaque structural tags, never interpreted.
 */
export interface GrowthPlanningInputItem {
  readonly id: string;
  readonly planType: GrowthPlanType;
  readonly opportunity: MarketOpportunityReference;
  /** Opaque structural tags (from `@age/capability-kit`); never branched on. */
  readonly executionDomains: readonly ExecutionDomain[];
  /** 0–100. Explicit scoring input. */
  readonly expectedImpact: number;
  /** 0–100. Explicit scoring input. */
  readonly confidence: number;
  /** 0–100. Explicit scoring input. */
  readonly estimatedEffort: number;
}

/**
 * GrowthInput — the in-memory input contract for a single Growth invocation
 * (ADR-0014). Caller-assembled; Growth reads no datastore and does not depend on
 * persisted Market Discovery output.
 *
 * `generatedAt` is the caller-supplied run timestamp (ISO); it is the only time
 * source the capability uses (e.g. for output-item createdAt) — no internal
 * clock reads.
 *
 * Client/organization authority invariant (enforced from the capability layer,
 * not by this contract type):
 *  - `ClientContext.clientId` / `ClientContext.organizationId` are AUTHORITATIVE
 *    for the produced `CapabilityOutput`.
 *  - `GrowthInput.clientId` / `GrowthInput.organizationId` are PROVENANCE / SCOPE
 *    fields describing the input batch.
 *  - Any future mismatch between the two must be handled by an explicit
 *    validation rule (and, if it changes behavior, an ADR update) — never
 *    silently ignored or guessed.
 */
export interface GrowthInput {
  readonly clientId: string;
  readonly organizationId: string;
  readonly planningItems: readonly GrowthPlanningInputItem[];
  readonly generatedAt: string;
}
